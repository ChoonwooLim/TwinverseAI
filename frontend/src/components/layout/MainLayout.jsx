import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { isOpenClawPath } from "./openClawNavigation";
import styles from "./MainLayout.module.css";

function getSidebarSection(pathname) {
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export default function MainLayout() {
  const location = useLocation();
  const isOpenClawPage = isOpenClawPath(location.pathname);
  const sidebarSection = isOpenClawPage ? null : getSidebarSection(location.pathname);

  return (
    <div className={styles.layout}>
      <TopBar />
      <div className={`${styles.body} ${isOpenClawPage ? styles.wideBody : ""}`}>
        {sidebarSection && <Sidebar section={sidebarSection} />}
        <main className={`${styles.content} ${!sidebarSection ? styles.full : ""}`}>
          <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh", color: "var(--text-secondary)" }}>로딩 중...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Footer />
    </div>
  );
}
