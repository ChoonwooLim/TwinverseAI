/**
 * Navigation data for the TwinverseDesk, 서비스 and 디자인 sidebars.
 *
 * Sidebar.jsx is part of the main bundle, so it reads this small module instead of
 * designs.json or platformContent.js (both only needed by lazily loaded pages).
 * sectionNav.test.js keeps these lists in sync with the real data.
 */

// Mirrors DESK_ITEMS in components/layout/TopBar.jsx (same labels, same order).
export const DESK_LINKS = [
  { label: "TVDesk 분석 보고서", path: "/twinversedesk/analysis" },
  { label: "TwinverseDesk 개발계획", path: "/twinversedesk/plan" },
  { label: "TwinverseDesk 실행", path: "/twinversedesk/launch" },
  { label: "TVDesk 실행", path: "/twinversedesk/run" },
];

// The id and name of each entry in CAPABILITIES (data/platformContent.js), in page order.
// The id is also the anchor of the capability on the 서비스 page.
export const SERVICE_CAPABILITIES = [
  { id: "desk", name: "TwinverseDesk" },
  { id: "agents", name: "OpenClaw 에이전트" },
  { id: "reports", name: "이메일 보고서" },
  { id: "design", name: "디자인 라이브러리" },
  { id: "community", name: "커뮤니티" },
];

// Category titles of data/designs.json, in page order.
const DESIGN_CATEGORY_TITLES = [
  "AI & Machine Learning",
  "Developer Tools & Platforms",
  "Infrastructure & Cloud",
  "Design & Productivity",
  "Fintech & Crypto",
  "Enterprise & Consumer",
];

/**
 * URL slug for a design category title: lowercase, runs of non-alphanumerics become one hyphen.
 * "AI & Machine Learning" -> "ai-machine-learning".
 * @param {string} title
 * @returns {string}
 */
export function toCategorySlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** @type {{ title: string, slug: string }[]} */
export const DESIGN_CATEGORIES = DESIGN_CATEGORY_TITLES.map((title) => ({ title, slug: toCategorySlug(title) }));

/**
 * @param {string | null | undefined} slug
 * @returns {{ title: string, slug: string } | undefined}
 */
export function designCategoryFromSlug(slug) {
  return DESIGN_CATEGORIES.find((category) => category.slug === slug);
}
