import { Link } from "react-router-dom";
import styles from "./PostList.module.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function PostList({ posts, boardType, basePath }) {
  const isGrid = boardType === "gallery";

  if (isGrid) {
    return (
      <div className={styles.grid}>
        {posts.map((p) => (
          <Link key={p.id} to={`${basePath}/${p.id}`} className={styles.card}>
            <div className={styles.thumbWrap}>
              {p.thumbnail ? (
                <img src={`${API_BASE}${p.thumbnail}`} alt={p.title} className={styles.thumb} loading="lazy" />
              ) : (
                <div className={styles.thumbPlaceholder}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
              )}
            </div>
            <div className={styles.cardBody}>
              <h4 className={styles.cardTitle}>{p.title}</h4>
              <div className={styles.cardFooter}>
                <span className={styles.cardMeta}>{p.author}</span>
                <span className={styles.cardMeta}>{p.view_count} views</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.thTitle}>제목</th>
          <th className={styles.thMeta}>작성자</th>
          <th className={styles.thMeta}>날짜</th>
          <th className={styles.thMeta}>조회</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((p) => (
          <tr key={p.id} className={p.is_pinned ? styles.pinned : ""}>
            <td>
              <Link to={`${basePath}/${p.id}`} className={styles.postLink}>
                {p.is_pinned && <span className={styles.pin}>[공지]</span>}
                {p.title}
              </Link>
            </td>
            <td className={styles.meta}>{p.author}</td>
            <td className={styles.meta}>{new Date(p.created_at).toLocaleDateString("ko-KR")}</td>
            <td className={styles.meta}>{p.view_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
