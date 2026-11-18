import { describe, expect, it } from "vitest";
import { findActiveLink, isChildActive, parseLinkPath } from "./sidebarActive";

// Same shapes as the sections in Sidebar.jsx.
const PRODUCT = [
  { label: "전체 보기", path: "/product" },
  { label: "동영상 프리셋", path: "/product/video" },
  { label: "3D 공간 프리셋", path: "/product/3d-space" },
];

const ADMIN = [
  { label: "대시보드", path: "/admin" },
  { label: "사용자 관리", path: "/admin/users" },
  {
    label: "Claude Code",
    path: "/admin/skills",
    children: [
      { label: "AI 스킬", path: "/admin/skills" },
      { label: "플러그인", path: "/admin/plugins" },
    ],
  },
  {
    label: "Unreal Engine",
    path: "/admin/docs/ue-project-setup",
    children: [
      { label: "프로젝트 설정", path: "/admin/docs/ue-project-setup" },
      { label: "Pixel Streaming 2", path: "/admin/docs/ue-pixel-streaming" },
    ],
  },
  {
    label: "프로젝트 문서",
    path: "/admin/docs",
    children: [
      { label: "개발계획", path: "/admin/docs/dev-plan" },
      { label: "작업일지", path: "/admin/docs/work-log" },
    ],
  },
];

const SERVICES = [
  { label: "전체 보기", path: "/services" },
  {
    label: "기능별 이용 안내",
    path: "/services#capabilities",
    defaultOpen: true,
    children: [
      { label: "TwinverseDesk", path: "/services#desk" },
      { label: "디자인 라이브러리", path: "/services#design" },
    ],
  },
  { label: "자주 묻는 질문", path: "/services#faq" },
];

const DESIGNS = [
  { label: "전체 보기", path: "/designs" },
  { label: "작업 흐름", path: "/designs#design-workflow-title" },
  { label: "실무 가이드", path: "/designs#design-guide" },
  {
    label: "디자인 라이브러리",
    path: "/designs#design-catalog",
    defaultOpen: true,
    children: [
      { label: "AI & Machine Learning", path: "/designs?category=ai-machine-learning#design-catalog" },
      { label: "Fintech & Crypto", path: "/designs?category=fintech-crypto#design-catalog" },
    ],
  },
];

const at = (pathname, search = "", hash = "") => ({ pathname, search, hash });

describe("parseLinkPath", () => {
  it("splits pathname, query and hash", () => {
    expect(parseLinkPath("/designs?category=ai-machine-learning#design-catalog")).toEqual({
      pathname: "/designs",
      search: "?category=ai-machine-learning",
      hash: "#design-catalog",
    });
    expect(parseLinkPath("/services#faq")).toEqual({ pathname: "/services", search: "", hash: "#faq" });
    expect(parseLinkPath("/admin/users")).toEqual({ pathname: "/admin/users", search: "", hash: "" });
    expect(parseLinkPath("/services#")).toEqual({ pathname: "/services", search: "", hash: "" });
  });
});

describe("findActiveLink: plain-path sections keep today's behaviour", () => {
  it("matches the exact pathname with aria-current page", () => {
    expect(findActiveLink(PRODUCT, at("/product"))).toEqual({ path: "/product", ariaCurrent: "page" });
    expect(findActiveLink(PRODUCT, at("/product/3d-space"))).toEqual({ path: "/product/3d-space", ariaCurrent: "page" });
    expect(findActiveLink(ADMIN, at("/admin/users"))).toEqual({ path: "/admin/users", ariaCurrent: "page" });
  });

  it("does not match on a prefix", () => {
    expect(findActiveLink(PRODUCT, at("/product/unknown"))).toBeNull();
    expect(findActiveLink(ADMIN, at("/admin/users/7"))).toBeNull();
    expect(findActiveLink(PRODUCT, at("/products"))).toBeNull();
  });

  it("ignores an unrelated hash or query", () => {
    expect(findActiveLink(PRODUCT, at("/product/video", "?utm=x", "#top"))).toEqual({ path: "/product/video", ariaCurrent: "page" });
    expect(findActiveLink(ADMIN, at("/admin", "", "#stats"))).toEqual({ path: "/admin", ariaCurrent: "page" });
  });

  it("returns the shared path when a group link and its first child point to the same page", () => {
    // Both links carry this path, so both stay highlighted as before.
    expect(findActiveLink(ADMIN, at("/admin/skills"))).toEqual({ path: "/admin/skills", ariaCurrent: "page" });
    expect(findActiveLink(ADMIN, at("/admin/docs/ue-project-setup"))).toEqual({ path: "/admin/docs/ue-project-setup", ariaCurrent: "page" });
  });

  it("matches a child-only page", () => {
    expect(findActiveLink(ADMIN, at("/admin/plugins"))).toEqual({ path: "/admin/plugins", ariaCurrent: "page" });
  });
});

describe("findActiveLink: hash and query links", () => {
  it("keeps the plain link current when the URL has no hash", () => {
    expect(findActiveLink(SERVICES, at("/services"))).toEqual({ path: "/services", ariaCurrent: "page" });
    expect(findActiveLink(DESIGNS, at("/designs"))).toEqual({ path: "/designs", ariaCurrent: "page" });
  });

  it("prefers a matching hash link with aria-current location", () => {
    expect(findActiveLink(SERVICES, at("/services", "", "#faq"))).toEqual({ path: "/services#faq", ariaCurrent: "location" });
    expect(findActiveLink(SERVICES, at("/services", "", "#capabilities"))).toEqual({ path: "/services#capabilities", ariaCurrent: "location" });
    expect(findActiveLink(DESIGNS, at("/designs", "", "#design-guide"))).toEqual({ path: "/designs#design-guide", ariaCurrent: "location" });
  });

  it("finds hash links among children", () => {
    expect(findActiveLink(SERVICES, at("/services", "", "#design"))).toEqual({ path: "/services#design", ariaCurrent: "location" });
  });

  it("falls back to the plain link for an unknown hash", () => {
    expect(findActiveLink(SERVICES, at("/services", "", "#nope"))).toEqual({ path: "/services", ariaCurrent: "page" });
  });

  it("prefers query + hash over hash alone", () => {
    expect(findActiveLink(DESIGNS, at("/designs", "?category=fintech-crypto", "#design-catalog"))).toEqual({
      path: "/designs?category=fintech-crypto#design-catalog",
      ariaCurrent: "location",
    });
  });

  it("allows extra query params in the location", () => {
    expect(findActiveLink(DESIGNS, at("/designs", "?q=claude&category=ai-machine-learning", "#design-catalog"))).toEqual({
      path: "/designs?category=ai-machine-learning#design-catalog",
      ariaCurrent: "location",
    });
  });

  it("rejects a link whose query value differs", () => {
    expect(findActiveLink(DESIGNS, at("/designs", "?category=unknown", "#design-catalog"))).toEqual({
      path: "/designs#design-catalog",
      ariaCurrent: "location",
    });
  });

  it("rejects a query link when its hash does not match", () => {
    expect(findActiveLink(DESIGNS, at("/designs", "?category=fintech-crypto"))).toEqual({ path: "/designs", ariaCurrent: "page" });
    expect(findActiveLink(DESIGNS, at("/designs", "?category=fintech-crypto", "#design-guide"))).toEqual({
      path: "/designs#design-guide",
      ariaCurrent: "location",
    });
  });

  it("gives ties to the first link in menu order", () => {
    const items = [
      { label: "First", path: "/z?k=1" },
      { label: "Second", path: "/z?k=1&j=2" },
    ];
    // Both have a matching query (same score), so the first wins.
    expect(findActiveLink(items, at("/z", "?k=1&j=2"))).toEqual({ path: "/z?k=1", ariaCurrent: "location" });
    expect(findActiveLink([...items].reverse(), at("/z", "?k=1&j=2"))).toEqual({ path: "/z?k=1&j=2", ariaCurrent: "location" });
  });

  it("returns null for another pathname", () => {
    expect(findActiveLink(SERVICES, at("/designs", "", "#faq"))).toBeNull();
  });
});

describe("isChildActive", () => {
  const group = (items, label) => items.find((item) => item.label === label);
  const groupFor = (items, location) => {
    const active = findActiveLink(items, location);
    return items.find((item) => isChildActive(item, location, active?.path))?.label ?? null;
  };

  it("is false for items without children", () => {
    expect(isChildActive(ADMIN[0], at("/admin"), "/admin")).toBe(false);
  });

  it("opens the group that holds the exact page", () => {
    expect(groupFor(ADMIN, at("/admin/plugins"))).toBe("Claude Code");
    expect(groupFor(ADMIN, at("/admin/skills"))).toBe("Claude Code");
    expect(groupFor(ADMIN, at("/admin/docs/ue-pixel-streaming"))).toBe("Unreal Engine");
    expect(groupFor(ADMIN, at("/admin/docs/work-log"))).toBe("프로젝트 문서");
  });

  it("keeps nested sub-paths of a child active (dated admin docs pages)", () => {
    const location = at("/admin/docs/dev-plan/2026-11-01");
    expect(findActiveLink(ADMIN, location)).toBeNull();
    expect(isChildActive(group(ADMIN, "프로젝트 문서"), location, undefined)).toBe(true);
    expect(isChildActive(group(ADMIN, "Unreal Engine"), location, undefined)).toBe(false);
    expect(groupFor(ADMIN, location)).toBe("프로젝트 문서");
  });

  it("does not treat a sibling with a shared prefix as nested", () => {
    expect(isChildActive(group(ADMIN, "프로젝트 문서"), at("/admin/docs/dev-planner"), undefined)).toBe(false);
  });

  it("is false on the group's own page when no child points there", () => {
    expect(groupFor(ADMIN, at("/admin/docs"))).toBeNull();
  });

  it("follows the active hash/query child", () => {
    expect(groupFor(SERVICES, at("/services", "", "#desk"))).toBe("기능별 이용 안내");
    expect(groupFor(SERVICES, at("/services", "", "#faq"))).toBeNull();
    expect(groupFor(DESIGNS, at("/designs", "?category=ai-machine-learning", "#design-catalog"))).toBe("디자인 라이브러리");
    expect(groupFor(DESIGNS, at("/designs", "", "#design-catalog"))).toBeNull();
  });
});
