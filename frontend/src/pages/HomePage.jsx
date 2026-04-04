import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import styles from "./HomePage.module.css";

export default function HomePage() {
  const [notices, setNotices] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    api.get("/api/boards/notice?size=3").then((r) => setNotices(r.data.items)).catch(() => {});
    api.get("/api/boards/qna?size=5").then((r) => setRecentPosts(r.data.items)).catch(() => {});
  }, []);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>TwinverseAI</h1>
        <p className={styles.heroSub}>차세대 AI 솔루션으로 비즈니스를 혁신하세요</p>
        <div className={styles.heroCta}>
          <Link to="/services" className={styles.primaryBtn}>서비스 알아보기</Link>
          <Link to="/about" className={styles.secondaryBtn}>회사 소개</Link>
        </div>
      </section>

      {notices.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>공지사항</h2>
            <Link to="/community/notice" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.noticeList}>
            {notices.map((n) => (
              <li key={n.id}>
                <Link to={`/community/notice/${n.id}`} className={styles.noticeItem}>
                  <span className={styles.noticeTitle}>{n.title}</span>
                  <span className={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>최신 Q&A</h2>
            <Link to="/community/qna" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.postList}>
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/community/qna/${p.id}`} className={styles.postItem}>
                  <span>{p.title}</span>
                  <span className={styles.postMeta}>{p.author} | {new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>서비스</h2>
        <div className={styles.serviceGrid}>
          <div className={styles.serviceCard}><h3>AI 컨설팅</h3><p>비즈니스에 최적화된 AI 전략을 수립합니다</p></div>
          <div className={styles.serviceCard}><h3>커스텀 AI 개발</h3><p>맞춤형 AI 모델과 솔루션을 개발합니다</p></div>
          <div className={styles.serviceCard}><h3>AI 교육</h3><p>팀의 AI 역량을 강화하는 교육 프로그램</p></div>
        </div>
      </section>
    </div>
  );
}
