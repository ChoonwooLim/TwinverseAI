import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import prose from "../../styles/prose.module.css";
import styles from "./DocDayDetail.module.css";

export default function DocDayDetail({ docKey, groups, date }) {
  const idx = groups.findIndex((g) => g.date === date);

  if (idx === -1) {
    return (
      <div>
        <p className={styles.notFound}>해당 날짜의 기록이 없습니다.</p>
        <Link to={`/admin/docs/${docKey}`} className={styles.backLink}>← 목록으로</Link>
      </div>
    );
  }

  const group = groups[idx];
  // groups는 날짜 내림차순 — 앞쪽이 더 최신이다.
  const newer = idx > 0 ? groups[idx - 1] : null;
  const older = idx < groups.length - 1 ? groups[idx + 1] : null;

  return (
    <div>
      <nav className={styles.bar}>
        <span className={styles.crumbs}>
          <Link to={`/admin/docs/${docKey}`} className={styles.crumbLink}>목록</Link>
          <span className={styles.sep}>›</span>
          <span>{group.year}년 {group.month}월</span>
          <span className={styles.sep}>›</span>
          <span className={styles.current}>{group.date}</span>
        </span>
        <span className={styles.nav}>
          {older && (
            <Link to={`/admin/docs/${docKey}/${older.date}`} className={styles.navLink}>
              ← {older.date.slice(5)}
            </Link>
          )}
          {newer && (
            <Link to={`/admin/docs/${docKey}/${newer.date}`} className={styles.navLink}>
              {newer.date.slice(5)} →
            </Link>
          )}
        </span>
      </nav>

      {group.entries.map((entry, i) => (
        <article key={i} className={styles.entry}>
          <h2 className={styles.entryTitle}>
            {group.date}
            {entry.title && <span className={styles.entrySub}>{entry.title}</span>}
          </h2>
          <div className={prose.prose}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
          </div>
        </article>
      ))}
    </div>
  );
}
