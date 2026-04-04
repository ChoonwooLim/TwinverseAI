import { Link } from "react-router-dom";
import styles from "./PostList.module.css";

export default function PostList({ posts, boardType, basePath }) {
  const isGrid = boardType === "gallery";

  if (isGrid) {
    return (
      <div className={styles.grid}>
        {posts.map((p) => (
          <Link key={p.id} to={`${basePath}/${p.id}`} className={styles.card}>
            {p.thumbnail && <img src={p.thumbnail} alt={p.title} className={styles.thumb} />}
            <div className={styles.cardBody}>
              <h4 className={styles.cardTitle}>{p.title}</h4>
              <span className={styles.cardMeta}>{p.author}</span>
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
