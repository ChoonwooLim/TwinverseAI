import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import { parseDoc, groupByDate, isTableDoc } from "../../utils/docEntries";
import DocTimeline from "../../components/docs/DocTimeline";
import DocDayDetail from "../../components/docs/DocDayDetail";
import { isTimelineDoc } from "../../components/docs/timelineDocs";
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
  // 날짜 미상 버킷은 "날"이 아니므로 일수에서 뺀다. 건수에는 그대로 포함한다.
  const parts = [`${dated.length}일`, `${entryCount}건`];
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

  // 목록 → 상세 → 목록 왕복에서 DocTimeline이 언마운트되므로 필터를 여기에 둔다.
  // docKey를 함께 담아, 다른 문서로 옮기면 별도 초기화 없이 자동으로 전체(null)가 된다.
  const [filterState, setFilterState] = useState({ docKey: null, filter: null });
  const filter = filterState.docKey === docKey ? filterState.filter : null;
  const handleFilterChange = (next) => setFilterState({ docKey, filter: next });

  const groups = useMemo(() => {
    // 타임라인은 명시된 로그 문서에만 적용한다 — 그 외 문서는 통짜 렌더 그대로 둔다.
    if (!isTimelineDoc(docKey)) return null;
    const entries = parseDoc(content);
    return entries ? groupByDate(entries) : null;
  }, [content, docKey]);

  // 하루 상세는 섹션형 전용이다. 표형은 엔트리 본문이 비어 있어 상세가 빈 껍데기가 되므로,
  // 손으로 친 URL·북마크·뒤로가기로 날짜가 붙어 들어와도 타임라인을 보여준다.
  const showDetail = Boolean(groups && date && !isTableDoc(groups));
  const showTimeline = Boolean(groups) && !showDetail;

  if (!docKey) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>프로젝트 문서</h1>
        <p className={styles.hint}>왼쪽 사이드바에서 문서를 선택하세요.</p>
      </div>
    );
  }

  return (
    // 넓은 측정폭은 2단 타임라인이 실제로 렌더될 때만 쓴다. fallback 산문 문서와
    // 하루 상세는 읽기 좋은 820px을 유지한다.
    <div className={showTimeline ? `${styles.page} ${styles.pageWide}` : styles.page}>
      <div className={styles.docHeader}>
        <span className={styles.overline}>Project Documentation</span>
        <h1 className={styles.title}>{DOC_TITLES[docKey] || docKey}</h1>
        {showTimeline && <p className={styles.summary}>{summarize(groups)}</p>}
      </div>
      {loading ? (
        <div className={styles.skeleton} aria-label="로딩 중">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : showDetail ? (
        <DocDayDetail docKey={docKey} groups={groups} date={date} />
      ) : showTimeline ? (
        <DocTimeline
          docKey={docKey}
          groups={groups}
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      ) : (
        <div className={prose.prose}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
