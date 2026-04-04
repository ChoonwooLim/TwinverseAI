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
      { label: "프로젝트 문서", path: "/admin/docs" },
      { label: "AI 스킬", path: "/admin/skills" },
      { label: "플러그인", path: "/admin/plugins" },
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
          <Link key={item.path} to={item.path} className={`${styles.link} ${location.pathname === item.path ? styles.active : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
