import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isOpenClawPath } from "./openClawNavigation";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "비전", path: "/vision" },
  { label: "회사소개", path: "/about" },
  { label: "서비스", path: "/services" },
  { label: "디자인", path: "/designs" },
  { label: "커뮤니티", path: "/community/notice" },
];

const DESK_ITEMS = [
  { label: "TVDesk 분석 보고서", path: "/twinversedesk/analysis" },
  { label: "TwinverseDesk 개발계획", path: "/twinversedesk/plan" },
  { label: "TwinverseDesk 실행", path: "/twinversedesk/launch" },
  { label: "TVDesk 실행", path: "/twinversedesk/run" },
];

function NavigationDropdown({ id, label, items, active, open, onToggle, onNavigate, pathname }) {
  return (
    <div className={styles.dropdown}>
      <button
        type="button"
        className={`${styles.navLink} ${styles.dropdownTrigger} ${active ? styles.active : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
      >
        {label}
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={id} className={styles.dropdownMenu} hidden={!open}>
        {items.map((item) => {
          const current = pathname.replace(/\/$/, "") === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`${styles.dropdownItem} ${current ? styles.dropdownItemActive : ""}`}
              aria-current={current ? "page" : undefined}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const navRef = useRef(null);
  const menuButtonRef = useRef(null);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isOpenClawPage = isOpenClawPath(location.pathname);

  const closeMenus = () => {
    setOpenDropdown(null);
    setMenuOpen(false);
  };

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
      if (!navRef.current?.contains(e.target) && !menuButtonRef.current?.contains(e.target)) {
        setOpenDropdown(null);
        setMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      const trigger = navRef.current?.querySelector('button[aria-expanded="true"]');
      if (trigger) {
        setOpenDropdown(null);
        trigger.focus();
      } else if (menuButtonRef.current?.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuButtonRef.current.focus();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>TwinverseAI</Link>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.hamburger}
          onClick={() => { setMenuOpen(!menuOpen); setOpenDropdown(null); }}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
        >
          <span /><span /><span />
        </button>
        <nav id="main-navigation" ref={navRef} aria-label="메인 메뉴" className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {NAV_ITEMS.map((item) =>
            item.external ? (
              <a
                key={item.external}
                href={item.external}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noopener noreferrer" : undefined}
                className={styles.navLink}
                onClick={closeMenus}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navLink} ${isActive(item.path) ? styles.active : ""}`}
                onClick={closeMenus}
              >
                {item.label}
              </Link>
            )
          )}
          <NavigationDropdown
            id="desk-navigation"
            label="TwinverseDesk"
            items={DESK_ITEMS}
            active={isActive("/twinversedesk")}
            open={openDropdown === "desk"}
            onToggle={() => setOpenDropdown((current) => current === "desk" ? null : "desk")}
            onNavigate={closeMenus}
            pathname={location.pathname}
          />
          {isAdmin && (
            <>
              <Link to="/admin/openclaw" className={`${styles.navLink} ${isOpenClawPage ? styles.active : ""}`} onClick={closeMenus}>
                OpenClaw
              </Link>
              <Link to="/admin" className={`${styles.navLink} ${isActive("/admin") && !isOpenClawPage ? styles.active : ""}`} onClick={closeMenus}>
                관리자
              </Link>
            </>
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
