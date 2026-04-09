import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "비전", path: "/vision" },
  { label: "회사소개", path: "/about" },
  { label: "서비스", path: "/services" },
  { label: "커뮤니티", path: "/community/notice" },
];

const DESK_ITEMS = [
  { label: "TVDesk 분석 보고서", path: "/twinversedesk/analysis" },
  { label: "TwinverseDesk 개발계획", path: "/twinversedesk/plan" },
  { label: "TwinverseDesk 실행", path: "/twinversedesk/launch" },
  { label: "TVDesk 실행", path: "/twinversedesk/run" },
];

function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const deskRef = useRef(null);
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deskRef.current && !deskRef.current.contains(e.target)) {
        setDeskOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <div className={styles.dropdown} ref={deskRef}>
            <button
              className={`${styles.navLink} ${styles.dropdownTrigger} ${isActive("/twinversedesk") ? styles.active : ""}`}
              onClick={() => setDeskOpen((v) => !v)}
            >
              TwinverseDesk
              <svg className={`${styles.chevron} ${deskOpen ? styles.chevronOpen : ""}`} width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {deskOpen && (
              <div className={styles.dropdownMenu}>
                {DESK_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`${styles.dropdownItem} ${location.pathname === item.path ? styles.dropdownItemActive : ""}`}
                    onClick={() => { setDeskOpen(false); setMenuOpen(false); }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
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

export default TopBar;
