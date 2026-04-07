import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import styles from "./AdminNews.module.css";

const CATEGORY_LABELS = {
  mode: "모드",
  skill: "스킬",
  plugin: "플러그인",
  feature: "기능",
  update: "업데이트",
  general: "일반",
};

const CATEGORY_COLORS = {
  mode: "#667eea",
  skill: "#00d4ff",
  plugin: "#f093fb",
  feature: "#4ade80",
  update: "#fbbf24",
  general: "#888",
};

export default function AdminNews() {
  const [newsList, setNewsList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/news/list")
      .then((r) => setNewsList(r.data))
      .catch(() => setNewsList([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    api
      .get(`/api/news/${id}`)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null));
  };

  if (loading) return <div className={styles.page}><p style={{ color: "#888" }}>로딩 중...</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Claude Code News</span>
        <h1 className={styles.title}>최근정보 ({newsList.length})</h1>
        <p className={styles.headerDesc}>
          Claude Code의 새 스킬, 모드, 플러그인, 기능 업데이트 등 최신 정보를 확인합니다.
        </p>
      </div>

      <ul className={styles.list}>
        {newsList.map((item, i) => (
          <li key={item.id} className={styles.item}>
            <button onClick={() => toggle(item.id)} className={styles.newsBtn}>
              <span className={styles.newsIndex}>{String(i + 1).padStart(2, "0")}</span>
              <div className={styles.newsBody}>
                <span className={styles.newsName}>
                  {item.title}
                  <span
                    className={styles.badge}
                    style={{
                      color: CATEGORY_COLORS[item.category] || "#888",
                      background: `${CATEGORY_COLORS[item.category] || "#888"}20`,
                      borderColor: `${CATEGORY_COLORS[item.category] || "#888"}40`,
                    }}
                  >
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                </span>
                <span className={styles.newsSummary}>{item.summary}</span>
                <span className={styles.newsDate}>
                  {new Date(item.discovered_at).toLocaleDateString("ko-KR")}
                  {item.source_url && (
                    <>
                      {" · "}
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.sourceLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        출처
                      </a>
                    </>
                  )}
                </span>
              </div>
              <span className={`${styles.chevron} ${openId === item.id ? styles.chevronOpen : ""}`}>
                ▼
              </span>
            </button>
            {openId === item.id && (
              <div className={styles.detail}>
                {detail ? (
                  <div className={styles.markdown}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p style={{ color: "#888" }}>로딩 중...</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
