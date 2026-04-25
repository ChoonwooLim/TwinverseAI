import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

      <h2 className={styles.sectionTitle}>관리 바로가기</h2>
      <Link to="/admin/openclaw" className={styles.featureCard}>
        <div className={styles.featureCardBadge}>OpenClaw · CLI Agent Broker</div>
        <h3 className={styles.featureCardTitle}>
          OpenClaw 게이트웨이 — 개요 / 랜딩
        </h3>
        <p className={styles.featureCardDesc}>
          LAN(twinverse-ai) · Hostinger 두 인스턴스, 배포 서버 인벤토리, RPC 프로토콜,
          환경변수, 활용 매트릭스를 한 페이지로. 이 어드민에서 콘솔/에이전트/채팅/로그까지 바로 진입.
        </p>
        <span className={styles.featureCardCta}>
          상세 보기 <span className={styles.featureCardArrow}>→</span>
        </span>
      </Link>
    </div>
  );
}
