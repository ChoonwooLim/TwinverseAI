import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminDesignMd.module.css";

function formatRelTime(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function SyncBadge({ status }) {
  if (!status) return null;
  const s = status.last_sync_status;
  if (s === "running") {
    return <span className={`${styles.syncBadge} ${styles.running}`}>🔄 동기화 진행 중...</span>;
  }
  if (s === "ok") {
    return (
      <span className={`${styles.syncBadge} ${styles.ok}`}>
        ✅ {status.samples_count}개 · {formatRelTime(status.last_sync_finished)}
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span
        className={`${styles.syncBadge} ${styles.failed}`}
        title={status.last_sync_error || ""}
      >
        ⚠️ 동기화 실패 · {formatRelTime(status.last_sync_finished)}
      </span>
    );
  }
  return <span className={`${styles.syncBadge} ${styles.never}`}>○ 아직 동기화 안 됨</span>;
}

export default function AdminDesignMd() {
  const [samples, setSamples] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef(null);

  const fetchAll = async () => {
    const [list, status] = await Promise.all([
      api.get("/api/design-md").then((r) => r.data),
      api.get("/api/design-md/sync/status").then((r) => r.data),
    ]);
    setSamples(list);
    setSyncStatus(status);
    return status;
  };

  useEffect(() => {
    fetchAll().catch((e) => console.error("[AdminDesignMd] load error", e));
    return () => clearInterval(pollRef.current);
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/design-md/sync");
    } catch (e) {
      if (e.response?.status !== 409) {
        alert("동기화 시작 실패: " + (e.response?.data?.detail || e.message));
        setSyncing(false);
        return;
      }
    }
    pollRef.current = setInterval(async () => {
      const status = await fetchAll();
      if (status.last_sync_status !== "running") {
        clearInterval(pollRef.current);
        setSyncing(false);
      }
    }, 3000);
  };

  const categories = useMemo(() => {
    const set = new Set(samples.map((s) => s.category).filter(Boolean));
    return Array.from(set).sort();
  }, [samples]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return samples.filter((s) => {
      if (activeCategory && s.category !== activeCategory) return false;
      if (q) {
        const hay = `${s.name} ${s.tagline}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [samples, query, activeCategory]);

  const isEmpty = samples.length === 0 && syncStatus?.last_sync_status === "never";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>디자인샘플</h1>
        <div className={styles.headerRight}>
          <SyncBadge status={syncStatus} />
          <button
            className={styles.syncBtn}
            onClick={triggerSync}
            disabled={syncing || syncStatus?.last_sync_status === "running"}
          >
            🔄 지금 동기화
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className={styles.empty}>
          <p>디자인 샘플이 아직 동기화되지 않았습니다.</p>
          <button className={styles.syncBtn} onClick={triggerSync} disabled={syncing}>
            지금 동기화
          </button>
        </div>
      ) : (
        <>
          <div className={styles.filterBar}>
            <input
              className={styles.search}
              type="text"
              placeholder="이름 또는 설명으로 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className={styles.chips}>
              <span
                className={`${styles.chip} ${!activeCategory ? styles.active : ""}`}
                onClick={() => setActiveCategory(null)}
              >
                전체 ({samples.length})
              </span>
              {categories.map((c) => (
                <span
                  key={c}
                  className={`${styles.chip} ${activeCategory === c ? styles.active : ""}`}
                  onClick={() => setActiveCategory(c)}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.grid}>
            {filtered.map((s) => (
              <Link key={s.slug} to={`/admin/design-md/${s.slug}`} className={styles.card}>
                <h3 className={styles.cardName}>{s.name}</h3>
                {s.category && <span className={styles.cardChip}>{s.category}</span>}
                <p className={styles.cardTagline}>{s.tagline}</p>
                <div className={styles.swatch} aria-label="대표 색상">
                  {(s.color_tokens || []).map((c, i) => (
                    <span key={i} style={{ background: c }} title={c} />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className={styles.footer}>
        Source:{" "}
        <a
          href="https://github.com/voltagent/awesome-design-md"
          target="_blank"
          rel="noreferrer"
        >
          voltagent/awesome-design-md
        </a>{" "}
        (MIT)
      </div>
    </div>
  );
}
