import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminEmailReports.module.css";

const PAGE_SIZE = 20;

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function Metric({ label, value, tone = "cyan" }) {
  return (
    <div className={`${styles.metric} ${styles[tone]}`}>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function ItemList({ title, description, items, accent }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`${styles.countBadge} ${styles[accent]}`}>{items.length}건</span>
      </div>
      {items.length === 0 ? (
        <div className={styles.sectionEmpty}>해당 메일이 없습니다.</div>
      ) : (
        <div className={styles.mailList}>
          {items.map((item, index) => (
            <article className={styles.mailItem} key={`${item.account}-${item.id || index}-${index}`}>
              <div className={styles.mailIndex}>{String(index + 1).padStart(2, "0")}</div>
              <div className={styles.mailBody}>
                <h4>{item.subject}</h4>
                <div className={styles.mailMeta}>
                  {item.sender && <span>{item.sender}</span>}
                  {item.account && <span>{item.account}</span>}
                  {item.receivedAt && <time>{formatDate(item.receivedAt, true)}</time>}
                </div>
                {item.reason && <p className={styles.reason}>{item.reason}</p>}
                {item.summary && <p className={styles.summary}>{item.summary}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportDetail({ report, loading, error, onBack }) {
  if (loading) return <div className={styles.detailState}><span className={styles.spinner} />보고서를 불러오는 중입니다.</div>;
  if (error) return <div className={`${styles.detailState} ${styles.error}`}>{error}</div>;
  if (!report) {
    return (
      <div className={styles.detailPlaceholder}>
        <div className={styles.placeholderIcon}>✉</div>
        <h2>보고서를 선택해 주세요</h2>
        <p>날짜별 메일 현황과 확인이 필요한 항목을 상세히 볼 수 있습니다.</p>
      </div>
    );
  }

  const counts = report.totalCounts || {};
  const cleanup = report.cleanupResults || {};
  const accounts = report.accountSummaries || [];

  return (
    <div className={styles.detailContent}>
      <button className={styles.mobileBack} type="button" onClick={onBack}>← 목록으로</button>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.eyebrow}>{report.reportKey}</span>
          <h2>{formatDate(report.reportDate)} 이메일 보고서</h2>
          <p>{report.metadata?.source || "자동 수집"} · 생성 {formatDate(report.metadata?.generatedAt, true)}</p>
        </div>
        <span className={styles.safeBadge}>메타데이터 전용</span>
      </header>

      <div className={styles.metrics}>
        <Metric label="전체 메일" value={counts.total} />
        <Metric label="중요 메일" value={counts.important} tone="violet" />
        <Metric label="조치 필요" value={counts.actionRequired} tone="amber" />
        <Metric label="정리 완료" value={counts.cleaned} tone="green" />
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><h3>계정별 현황</h3><p>연결된 메일 계정의 핵심 지표입니다.</p></div>
          <span className={styles.countBadge}>{accounts.length}개 계정</span>
        </div>
        <div className={styles.accountGrid}>
          {accounts.map((account) => (
            <article className={styles.accountCard} key={account.account}>
              <h4>{account.account}</h4>
              <dl>
                <div><dt>전체</dt><dd>{Number(account.total || 0).toLocaleString("ko-KR")}</dd></div>
                <div><dt>중요</dt><dd>{Number(account.important || 0).toLocaleString("ko-KR")}</dd></div>
                <div><dt>조치 필요</dt><dd>{Number(account.actionRequired || 0).toLocaleString("ko-KR")}</dd></div>
              </dl>
              {account.note && <p>{account.note}</p>}
            </article>
          ))}
        </div>
      </section>

      <ItemList
        title="조치가 필요한 메일"
        description="확인하거나 후속 작업이 필요한 항목입니다."
        items={report.actionRequiredItems || []}
        accent="amber"
      />
      <ItemList
        title="중요 메일"
        description="중요 기준으로 분류된 메일 요약입니다."
        items={report.importantItems || []}
        accent="violet"
      />

      <section className={styles.cleanupCard}>
        <div><span>보관</span><strong>{Number(cleanup.archived || 0).toLocaleString("ko-KR")}건</strong></div>
        <div><span>삭제함 이동</span><strong>{Number(cleanup.deleted || 0).toLocaleString("ko-KR")}건</strong></div>
        <div><span>건너뜀</span><strong>{Number(cleanup.skipped || 0).toLocaleString("ko-KR")}건</strong></div>
        <p>{cleanup.notes || "정리 메모가 없습니다."}</p>
      </section>
    </div>
  );
}

export default function AdminEmailReports() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/api/admin/email-reports?page=${page}&size=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ data }) => setList(data))
      .catch((error) => {
        if (error.code !== "ERR_CANCELED") setListError("보고서 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    if (!reportId) return undefined;
    const controller = new AbortController();
    api.get(`/api/admin/email-reports/${reportId}`, { signal: controller.signal })
      .then(({ data }) => setDetail(data))
      .catch((error) => {
        if (error.code !== "ERR_CANCELED") {
          setDetail(null);
          setDetailError(error.response?.status === 404 ? "보고서를 찾을 수 없습니다." : "보고서 상세를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [reportId]);

  const selectedDetail = reportId && detail?.id === Number(reportId) ? detail : null;
  const selectedLoading = Boolean(reportId) && (detailLoading || (!selectedDetail && !detailError));
  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const rangeText = useMemo(() => {
    if (!list.total) return "0건";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, list.total);
    return `${start}-${end} / ${list.total}건`;
  }, [list.total, page]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>EMAIL OPERATIONS</span>
          <h1>이메일 보고서</h1>
          <p>자동 수집된 계정별 현황과 중요·조치 필요 메일을 안전하게 확인합니다.</p>
        </div>
        <div className={styles.privacyNote}><span>✓</span> 본문·첨부파일·인증정보는 저장하지 않습니다.</div>
      </header>

      <div className={`${styles.workspace} ${reportId ? styles.hasSelection : ""}`}>
        <aside className={styles.reportPanel} aria-label="이메일 보고서 목록">
          <div className={styles.panelHeader}><h2>보고서 기록</h2><span>{rangeText}</span></div>
          {listLoading ? (
            <div className={styles.listState}><span className={styles.spinner} />목록을 불러오는 중입니다.</div>
          ) : listError ? (
            <div className={`${styles.listState} ${styles.error}`}>{listError}</div>
          ) : list.items.length === 0 ? (
            <div className={styles.listState}>아직 수집된 보고서가 없습니다.</div>
          ) : (
            <div className={styles.reportList}>
              {list.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.reportRow} ${Number(reportId) === item.id ? styles.active : ""}`}
                  onClick={() => {
                    setDetailLoading(true);
                    setDetailError("");
                    navigate(`/admin/email-reports/${item.id}`);
                  }}
                >
                  <div className={styles.rowTop}><strong>{formatDate(item.reportDate)}</strong><span>{item.reportKey}</span></div>
                  <div className={styles.rowMetrics}>
                    <span>전체 <b>{Number(item.totalCounts?.total || 0).toLocaleString("ko-KR")}</b></span>
                    <span>중요 <b>{Number(item.totalCounts?.important || 0).toLocaleString("ko-KR")}</b></span>
                    <span className={styles.actionMetric}>조치 <b>{Number(item.totalCounts?.actionRequired || 0).toLocaleString("ko-KR")}</b></span>
                  </div>
                  <small>{item.accountCount}개 계정 · {formatDate(item.generatedAt, true)}</small>
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button type="button" disabled={page <= 1} onClick={() => { setListLoading(true); setListError(""); setPage((value) => value - 1); }}>이전</button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => { setListLoading(true); setListError(""); setPage((value) => value + 1); }}>다음</button>
            </div>
          )}
        </aside>

        <main className={styles.detailPanel}>
          <ReportDetail
            report={selectedDetail}
            loading={selectedLoading}
            error={detailError}
            onBack={() => navigate("/admin/email-reports")}
          />
        </main>
      </div>
    </div>
  );
}
