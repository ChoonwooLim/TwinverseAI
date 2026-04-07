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
        label: "Claude Code",
        path: "/admin/skills",
        children: [
          { label: "AI 스킬", path: "/admin/skills" },
          { label: "플러그인", path: "/admin/plugins" },
          { label: "최근정보", path: "/admin/news" },
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
        ],
      },
    ],
  },
};

export default function Sidebar({ section }) {
  const location = useLocation();
  const config = SIDEBAR_CONFIG[section];
  if (!config) return null;

  return (
    <aside className={styles.sidebar}>
      <h3 className={styles.title}>{config.title}</h3>
      <nav className={styles.nav}>
        {config.items.map((item) => (
          <div key={item.path}>
            <Link to={item.path} className={`${styles.link} ${location.pathname === item.path ? styles.active : ""}`}>
              {item.label}
            </Link>
            {item.children && (
              <div className={styles.subNav}>
                {item.children.map((child) => (
                  <Link key={child.path} to={child.path} className={`${styles.subLink} ${location.pathname === child.path ? styles.active : ""}`}>
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
