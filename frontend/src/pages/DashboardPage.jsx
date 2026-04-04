import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import s from "./DashboardPage.module.css";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/admin/dashboard").then(({ data }) => setStats(data));
  }, []);

  return (
    <div className={s.page}>
      {/* ── Top bar ── */}
      <header className={s.topBar}>
        <span className={s.title}>Admin Dashboard</span>
        <Link to="/" className={s.backLink}>
          Home
        </Link>
      </header>

      {/* ── Content ── */}
      {!stats ? (
        <div className={s.skeleton}>
          <div className={s.skeletonPulse} />
        </div>
      ) : (
        <section className={s.statsSection}>
          <div className={s.statsRow}>
            <div className={s.statBlock}>
              <span className={s.statNumber}>{stats.total_users}</span>
              <span className={s.statLabel}>Total Users</span>
            </div>
            <div className={s.statBlock}>
              <span className={s.statNumber}>{stats.active_users}</span>
              <span className={s.statLabel}>Active Users</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <div className={s.footerLine}>
        <span className={s.footerText}>TwinverseAI</span>
      </div>
    </div>
  );
}
