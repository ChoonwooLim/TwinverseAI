import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import { parseDoc, groupByDate } from "../../utils/docEntries";
import DocTimeline from "../../components/docs/DocTimeline";
import DocDayDetail from "../../components/docs/DocDayDetail";
import prose from "../../styles/prose.module.css";
import styles from "./AdminDocs.module.css";

const DOC_TITLES = {
  "dev-plan": "개발계획",
  "bugfix-log": "버그수정 로그",
  "upgrade-log": "업그레이드 로그",
  "work-log": "작업일지",
  "pixel-streaming-server": "픽셀스트리밍 서버",
};

/** "24일 · 29건 · 2026.04 – 07" */
function summarize(groups) {
  const dated = groups.filter((g) => g.year !== null);
  const entryCount = groups.reduce((n, g) => n + g.entries.length, 0);
  const parts = [`${groups.length}일`, `${entryCount}건`];
  if (dated.length) {
    const fmt = (g) => `${g.year}.${String(g.month).padStart(2, "0")}`;
    const to = fmt(dated[0]);                    // groups는 내림차순이라 앞이 최신
    const from = fmt(dated[dated.length - 1]);
    parts.push(from === to ? to : `${from} – ${to}`);
  }
  return parts.join(" · ");
}

export default function AdminDocs() {
  const { docKey, date } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docKey) return;
    setLoading(true);
    api.get(`/api/docs/${docKey}`)
      .then((r) => setContent(r.data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  const groups = useMemo(() => {
    const entries = parseDoc(content);
    return entries ? groupByDate(entries) : null;
  }, [content]);

  if (!docKey) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>프로젝트 문서</h1>
        <p className={styles.hint}>왼쪽 사이드바에서 문서를 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.docHeader}>
        <span className={styles.overline}>Project Documentation</span>
        <h1 className={styles.title}>{DOC_TITLES[docKey] || docKey}</h1>
        {groups && !date && <p className={styles.summary}>{summarize(groups)}</p>}
      </div>
      {loading ? (
        <div className={styles.skeleton} aria-label="로딩 중">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : groups ? (
        date ? (
          <DocDayDetail docKey={docKey} groups={groups} date={date} />
        ) : (
          <DocTimeline docKey={docKey} groups={groups} />
        )
      ) : (
        <div className={prose.prose}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
