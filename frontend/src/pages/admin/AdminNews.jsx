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

const STATUS_LABELS = {
  pending: "대기",
  needs_approval: "승인 필요",
  applied: "적용됨",
  info_only: "정보",
  ignored: "무시",
  failed: "실패",
};

const STATUS_COLORS = {
  pending: "#fbbf24",         // amber — awaiting auto-apply
  needs_approval: "#f97316",  // orange — user action required
  applied: "#4ade80",         // green
  info_only: "#9ca3af",       // gray
  ignored: "#6b7280",         // dim gray
  failed: "#ef4444",          // red
};

const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "needs_approval", label: "승인 필요" },
  { key: "applied", label: "적용됨" },
  { key: "info_only", label: "정보" },
];

export default function AdminNews() {
  const [newsList, setNewsList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const url = statusFilter === "all"
      ? "/api/news/list"
      : `/api/news/list?status=${encodeURIComponent(statusFilter)}`;
    setLoading(true);
    api
      .get(url)
      .then((r) => setNewsList(r.data))
      .catch(() => setNewsList([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

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
          news-watch 자동 크롤러가 매일 09:00 KST 에 새 항목을 수집·분석합니다.
        </p>
        <div className={styles.filterBar}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`${styles.filterBtn} ${statusFilter === f.key ? styles.filterBtnActive : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
                  {item.apply_status && item.apply_status !== "info_only" && (
                    <span
                      className={styles.badge}
                      style={{
                        color: STATUS_COLORS[item.apply_status] || "#888",
                        background: `${STATUS_COLORS[item.apply_status] || "#888"}20`,
                        borderColor: `${STATUS_COLORS[item.apply_status] || "#888"}40`,
                      }}
                    >
                      {STATUS_LABELS[item.apply_status] || item.apply_status}
                    </span>
                  )}
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
