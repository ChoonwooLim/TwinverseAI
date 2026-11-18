import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { OPENCLAW_ITEMS } from "./openClawNavigation";
import { findActiveLink, isChildActive } from "./sidebarActive";
import { PRESET_CATEGORIES } from "../../data/productPresets";
import { DESIGN_CATEGORIES, DESK_LINKS, SERVICE_CAPABILITIES } from "../../data/sectionNav";
import styles from "./Sidebar.module.css";

const SIDEBAR_CONFIG = {
  openclaw: {
    title: "OpenClaw",
    items: OPENCLAW_ITEMS,
  },
  product: {
    title: "Product",
    items: [
      { label: "전체 보기", path: "/product" },
      // Generated from the data file so the menu cannot drift from the categories.
      ...PRESET_CATEGORIES.map((category) => ({ label: category.label, path: `/product/${category.slug}` })),
    ],
  },
  desk: {
    title: "TwinverseDesk",
    items: DESK_LINKS,
  },
  // Single-page sections: the links jump to sections inside the page.
  services: {
    title: "서비스",
    items: [
      { label: "전체 보기", path: "/services" },
      {
        label: "기능별 이용 안내",
        path: "/services#capabilities",
        defaultOpen: true,
        children: SERVICE_CAPABILITIES.map((capability) => ({ label: capability.name, path: `/services#${capability.id}` })),
      },
      { label: "활용 사례", path: "/services#use-cases" },
      { label: "자주 묻는 질문", path: "/services#faq" },
      { label: "다음 기능", path: "/services#next" },
    ],
  },
  designs: {
    title: "디자인",
    items: [
      { label: "전체 보기", path: "/designs" },
      { label: "작업 흐름", path: "/designs#design-workflow-title" },
      { label: "실무 가이드", path: "/designs#design-guide" },
      {
        label: "디자인 라이브러리",
        path: "/designs#design-catalog",
        defaultOpen: true,
        // The category param selects the filter on the page (DesignGallery reads it from the URL).
        children: DESIGN_CATEGORIES.map((category) => ({ label: category.title, path: `/designs?category=${category.slug}#design-catalog` })),
      },
    ],
  },
  community: {
    title: "커뮤니티",
    items: [
      { label: "공지사항", path: "/community/notice" },
      { label: "Q&A", path: "/community/qna" },
      { label: "이미지 갤러리", path: "/community/gallery" },
      { label: "동영상", path: "/community/videos" },
    ],
  },
  admin: {
    title: "관리자",
    items: [
      { label: "대시보드", path: "/admin" },
      { label: "사용자 관리", path: "/admin/users" },
      { label: "게시판 관리", path: "/admin/boards" },
      { label: "이메일 보고서", path: "/admin/email-reports" },
      {
        label: "Claude Code",
        path: "/admin/skills",
        children: [
          { label: "AI 스킬", path: "/admin/skills" },
          { label: "플러그인", path: "/admin/plugins" },
          { label: "최근정보", path: "/admin/news" },
          { label: "디자인샘플", path: "/admin/design-md" },
          { label: "Claw Code 분석", path: "/admin/claw-code" },
          { label: "공식 레포 분석", path: "/admin/claude-code-repo" },
        ],
      },
      {
        label: "Unreal Engine",
        path: "/admin/docs/ue-project-setup",
        children: [
          { label: "프로젝트 설정", path: "/admin/docs/ue-project-setup" },
          { label: "Pixel Streaming 2", path: "/admin/docs/ue-pixel-streaming" },
          { label: "PS2 Spawner API", path: "/admin/docs/ue-spawner-api" },
          { label: "GPU 클라우드 호스팅", path: "/admin/docs/ue-gpu-hosting" },
          { label: "EOS Online Framework", path: "/admin/docs/ue-eos-framework" },
        ],
      },
      {
        label: "프로젝트 문서",
        path: "/admin/docs",
        children: [
          { label: "개발계획", path: "/admin/docs/dev-plan" },
          { label: "버그수정 로그", path: "/admin/docs/bugfix-log" },
          { label: "업그레이드 로그", path: "/admin/docs/upgrade-log" },
          { label: "작업일지", path: "/admin/docs/work-log" },
          { label: "Orbitron 서버", path: "/admin/docs/orbitron-server" },
          { label: "픽셀스트리밍 서버", path: "/admin/docs/pixel-streaming-server" },
        ],
      },
    ],
  },
};

// Sections that stay reachable on phones as a horizontally scrolling strip.
const MOBILE_STRIP_SECTIONS = new Set(["openclaw", "admin", "product", "desk", "services", "designs"]);

// Long pages whose sidebar works as a table of contents: keep it in view while scrolling.
const STICKY_SECTIONS = new Set(["desk", "services", "designs"]);

const STORAGE_KEY = "twinverse:sidebar:collapsed";

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function Sidebar({ section }) {
  const location = useLocation();
  const config = SIDEBAR_CONFIG[section];

  const [collapsed, setCollapsed] = useState(loadCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore quota */
    }
  }, [collapsed]);

  const toggle = (key, currentlyOpen) => {
    setCollapsed((prev) => ({ ...prev, [key]: currentlyOpen }));
  };

  // One current link per section; links sharing its path (a group and its first child) are all shown as current.
  const activeLink = config ? findActiveLink(config.items, location) : null;
  const activePath = activeLink?.path;
  const ariaCurrentFor = (path) => (path === activePath ? activeLink.ariaCurrent : undefined);
  const currentGroupKey = config?.items.find((item) => isChildActive(item, location, activePath))?.path ?? null;

  // Keep the current entry visible inside the mobile strip without moving the page.
  // Only top-level rows count: nested links are hidden in the strip.
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector(`.${styles.row} > [aria-current]`);
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.left < navBox.left || box.right > navBox.right) {
      nav.scrollLeft += box.left - navBox.left - (navBox.width - box.width) / 2;
    }
  }, [section, activePath]);

  if (!config) return null;

  return (
    <aside className={`${styles.sidebar} ${MOBILE_STRIP_SECTIONS.has(section) ? styles.mobileStrip : ""} ${STICKY_SECTIONS.has(section) ? styles.sticky : ""}`} aria-label={config.title}>
      <div className={styles.inner}>
      <h3 className={styles.title}>{config.title}</h3>
      <nav ref={navRef} className={styles.nav} aria-label={`${config.title} 메뉴`}>
        {config.items.map((item) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const userCollapsed = collapsed[item.path];
          const isGroupActive = currentGroupKey === item.path;
          // An explicit user choice wins; otherwise open when it holds the current link or is flagged defaultOpen.
          const isOpen = hasChildren
            ? userCollapsed === undefined
              ? isGroupActive || item.defaultOpen === true
              : !userCollapsed
            : false;

          return (
            <div key={item.path}>
              <div className={styles.row}>
                <Link
                  to={item.path}
                  aria-current={ariaCurrentFor(item.path)}
                  className={`${styles.link} ${item.path === activePath ? styles.active : ""} ${hasChildren ? styles.linkWithToggle : ""}`}
                >
                  {item.label}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    className={`${styles.toggle} ${isOpen ? styles.toggleOpen : ""}`}
                    onClick={() => toggle(item.path, isOpen)}
                    aria-label={isOpen ? `${item.label} 접기` : `${item.label} 펼치기`}
                    aria-expanded={isOpen}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              {hasChildren && isOpen && (
                <div className={styles.subNav}>
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      aria-current={ariaCurrentFor(child.path)}
                      className={`${styles.subLink} ${child.path === activePath ? styles.active : ""}`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      </div>
    </aside>
  );
}
