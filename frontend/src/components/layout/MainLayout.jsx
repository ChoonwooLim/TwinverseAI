import { Outlet, useLocation } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import styles from "./MainLayout.module.css";

function getSidebarSection(pathname) {
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export default function MainLayout() {
  const location = useLocation();
  const sidebarSection = getSidebarSection(location.pathname);

  return (
    <div className={styles.layout}>
      <TopBar />
      <div className={styles.body}>
        {sidebarSection && <Sidebar section={sidebarSection} />}
        <main className={`${styles.content} ${!sidebarSection ? styles.full : ""}`}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
