import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminDashboard.module.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <p>로딩 중...</p>;

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>관리자 대시보드</h1>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_users}</span>
          <span className={styles.statLabel}>전체 사용자</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.active_users}</span>
          <span className={styles.statLabel}>활성 사용자</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_posts}</span>
          <span className={styles.statLabel}>전체 게시물</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_comments}</span>
          <span className={styles.statLabel}>전체 댓글</span>
        </div>
      </div>
    </div>
  );
}
