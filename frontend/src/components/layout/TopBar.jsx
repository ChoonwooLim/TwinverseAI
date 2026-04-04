import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "회사소개", path: "/about" },
  { label: "서비스", path: "/services" },
  { label: "커뮤니티", path: "/community/notice" },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>TwinverseAI</Link>
        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="메뉴 열기">
          <span /><span /><span />
        </button>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} className={`${styles.navLink} ${isActive(item.path) ? styles.active : ""}`} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className={`${styles.navLink} ${isActive("/admin") ? styles.active : ""}`} onClick={() => setMenuOpen(false)}>
              관리자
            </Link>
          )}
        </nav>
        <div className={styles.auth}>
          {token ? (
            <div className={styles.userMenu}>
              <span className={styles.username}>{user?.username}</span>
              <button onClick={handleLogout} className={styles.logoutBtn}>로그아웃</button>
            </div>
          ) : (
            <Link to="/login" className={styles.loginBtn}>로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}
