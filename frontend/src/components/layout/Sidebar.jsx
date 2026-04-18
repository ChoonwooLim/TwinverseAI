import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";

const SIDEBAR_CONFIG = {
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
      {
        label: "OpenClaw",
        path: "/admin/openclaw-console",
        children: [
          { label: "콘솔", path: "/admin/openclaw-console" },
          { label: "에이전트", path: "/admin/openclaw-console/agents" },
          { label: "플러그인", path: "/admin/openclaw-console/plugins" },
          { label: "설정", path: "/admin/openclaw-console/config" },
          { label: "토큰", path: "/admin/openclaw-console/token" },
          { label: "채팅", path: "/admin/openclaw-console/chat" },
          { label: "로그", path: "/admin/openclaw-console/logs" },
          { label: "디바이스 페어링", path: "/admin/openclaw-devices" },
        ],
      },
      {
        label: "Claude Code",
        path: "/admin/skills",
        children: [
          { label: "AI 스킬", path: "/admin/skills" },
          { label: "플러그인", path: "/admin/plugins" },
          { label: "최근정보", path: "/admin/news" },
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

const STORAGE_KEY = "twinverse:sidebar:collapsed";

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isChildActive(item, pathname) {
  if (!item.children) return false;
  return item.children.some((c) => pathname === c.path || pathname.startsWith(c.path + "/"));
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

  const currentGroupKey = useMemo(() => {
    if (!config) return null;
    const match = config.items.find((item) => isChildActive(item, location.pathname));
    return match ? match.path : null;
  }, [config, location.pathname]);

  if (!config) return null;

  return (
    <aside className={styles.sidebar}>
      <h3 className={styles.title}>{config.title}</h3>
      <nav className={styles.nav}>
        {config.items.map((item) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const userCollapsed = collapsed[item.path];
          const isGroupActive = currentGroupKey === item.path;
          const isOpen = hasChildren
            ? userCollapsed === undefined
              ? isGroupActive
              : !userCollapsed
            : false;

          return (
            <div key={item.path}>
              <div className={styles.row}>
                <Link
                  to={item.path}
                  className={`${styles.link} ${location.pathname === item.path ? styles.active : ""} ${hasChildren ? styles.linkWithToggle : ""}`}
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
                      className={`${styles.subLink} ${location.pathname === child.path ? styles.active : ""}`}
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
    </aside>
  );
}
