import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { buildEmailSourceLink } from "../../utils/emailSourceLink";
import styles from "./AdminEmailReports.module.css";

const PAGE_SIZE = 20;

const PRIORITY_ORDER = { urgent: 0, important: 1, reference: 2 };
const PRIORITY_LABELS = {
  urgent: "긴급",
  important: "중요",
  reference: "참고",
};

const DECISION_OPTIONS = [
  { key: "keep", label: "보존", help: "보존 결정만 기록하며 메일함은 변경하지 않습니다." },
  { key: "trash", label: "삭제함 이동", help: "삭제함 이동 결정만 기록하며 메일은 이동하지 않습니다." },
  { key: "auto_trash_similar", label: "같은 유형 자동 삭제", help: "같은 유형의 자동 삭제 규칙 결정만 기록합니다." },
  { key: "always_keep_similar", label: "같은 유형 항상 보존", help: "같은 유형의 항상 보존 규칙 결정만 기록합니다." },
  { key: "auto_archive", label: "자동 보관", help: "같은 유형의 자동 보관 규칙 결정만 기록합니다." },
  { key: "decide_later", label: "나중 결정", help: "추가 확인이 필요해 결정을 나중으로 미룹니다." },
];

const DECISION_LABELS = DECISION_OPTIONS.reduce((acc, opt) => {
  acc[opt.key] = opt.label;
  return acc;
}, {});

const RISK_TAG_LABELS = {
  payment: "결제",
  security: "보안",
  account: "계정",
  deletion: "삭제 추천",
  automation: "자동화 추천",
};

const SORT_OPTIONS = [
  { key: "all", label: "전체" },
  { key: "urgent", label: "긴급 먼저" },
  { key: "important", label: "중요 먼저" },
  { key: "reference", label: "참고만" },
  { key: "pending", label: "미결정만" },
];

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

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

function Metric({ label, value, tone = "cyan", title }) {
  return (
    <div className={`${styles.metric} ${styles[tone]}`} title={title || label} role="listitem">
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const key = PRIORITY_LABELS[priority] ? priority : "reference";
  return (
    <span className={`${styles.priorityBadge} ${styles[`priority_${key}`]}`}>
      {PRIORITY_LABELS[key]}
    </span>
  );
}

function RiskTag({ tag }) {
  if (!RISK_TAG_LABELS[tag]) return null;
  return <span className={`${styles.riskTag} ${styles[`risk_${tag}`]}`}>{RISK_TAG_LABELS[tag]}</span>;
}

function DecisionItem({
  item,
  decision,
  pendingDecision,
  selected,
  onToggleSelect,
  onPickDecision,
  onClearDecision,
  saving,
}) {
  const currentDecision = pendingDecision ?? decision?.decision ?? null;
  const dirty = pendingDecision != null && pendingDecision !== decision?.decision;
  const itemId = item.id || "";
  const reactId = useId();
  const checkboxId = `email-item-${reactId.replace(/:/g, "")}`;
  const sourceLink = buildEmailSourceLink(item);

  return (
    <article className={`${styles.itemCard} ${selected ? styles.selected : ""}`} aria-labelledby={`${checkboxId}-subject`}>
      <div className={styles.itemHead}>
        <label className={styles.selectLabel} htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(itemId)}
            disabled={!itemId}
            aria-label={`${item.subject} 선택`}
          />
          <span aria-hidden="true" />
        </label>
        <div className={styles.itemHeadMain}>
          <div className={styles.itemBadges}>
            <PriorityBadge priority={item.priority || "reference"} />
            {(item.riskTags || []).map((tag) => <RiskTag key={tag} tag={tag} />)}
            {dirty && <span className={styles.dirtyBadge}>저장 대기</span>}
            {currentDecision && !dirty && (
              <span className={styles.savedBadge} title={decision?.decidedByUsername || ""}>
                저장됨 · {DECISION_LABELS[currentDecision] || currentDecision}
              </span>
            )}
          </div>
          <h4 id={`${checkboxId}-subject`}>{item.subject}</h4>
          <div className={styles.itemMeta}>
            <span>계정 {item.account || "정보 없음"}</span>
            <span>발신자 {item.sender || "정보 없음"}</span>
            <span>수신 {item.receivedAt ? <time dateTime={item.receivedAt}>{formatDate(item.receivedAt, true)}</time> : "정보 없음"}</span>
          </div>
          {sourceLink && (
            <a
              className={`${styles.sourceLink} ${sourceLink.exact ? styles.sourceLinkExact : styles.sourceLinkSearch}`}
              href={sourceLink.href}
              target="_blank"
              rel="noopener noreferrer"
              title={sourceLink.title}
            >
              <span aria-hidden="true">↗</span> {sourceLink.label}
            </a>
          )}
        </div>
      </div>

      <dl className={styles.itemFacts}>
        <div><dt>한눈 요약</dt><dd>{item.summary || "구형 보고서에는 내용 기반 요약이 제공되지 않았습니다."}</dd></div>
        <div><dt>중요한 이유</dt><dd>{item.reason || item.classificationBasis || "수집 시 중요도 근거가 제공되지 않았습니다."}</dd></div>
        {(item.deadline || item.urgency) && (
          <div>
            <dt>마감 / 시급성</dt>
            <dd>
              {item.deadline && <strong>{formatDate(item.deadline, true)}</strong>}
              {item.deadline && item.urgency && <span aria-hidden="true"> · </span>}
              {item.urgency && <span>{item.urgency}</span>}
            </dd>
          </div>
        )}
        <div><dt>권장 조치</dt><dd>{item.recommendedAction || "관리자 검토 후 보존, 삭제함 이동, 자동화 또는 나중 결정을 선택하세요."}</dd></div>
        {item.classificationBasis && (
          <div><dt>분류 근거</dt><dd>{item.classificationBasis}</dd></div>
        )}
      </dl>

      <div className={styles.decisionRow} role="group" aria-label={`${item.subject} 결정`}>
        {DECISION_OPTIONS.map((opt) => {
          const active = currentDecision === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              className={`${styles.decisionButton} ${active ? styles.decisionActive : ""}`}
              onClick={() => onPickDecision(itemId, opt.key, decision?.decision)}
              disabled={saving || !itemId}
              aria-pressed={active}
              title={opt.help}
            >
              {opt.label}
            </button>
          );
        })}
        {currentDecision && (
          <button
            type="button"
            className={styles.decisionReset}
            onClick={() => onClearDecision(itemId, decision != null, pendingDecision != null)}
            disabled={saving}
          >
            결정 취소
          </button>
        )}
      </div>
    </article>
  );
}

function ConfirmModal({ open, title, body, confirmLabel = "적용", onConfirm, onCancel, busy }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []);
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel?.();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous && previous.focus && previous.focus();
    };
  }, [busy, open, onCancel]);

  if (!open) return null;
  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="email-confirm-title"
        aria-describedby="email-confirm-body"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 id="email-confirm-title">{title}</h3>
        <div id="email-confirm-body" className={styles.modalBody}>{body}</div>
        <div className={styles.modalActions}>
          <button type="button" onClick={onCancel} disabled={busy}>취소</button>
          <button type="button" className={styles.modalConfirm} onClick={onConfirm} disabled={busy}>
            {busy ? "적용 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportDetail({ report, loading, error, onBack, onRefresh }) {
  const [sortKey, setSortKey] = useState("urgent");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pending, setPending] = useState(() => new Map());
  const [bulkChoice, setBulkChoice] = useState(DECISION_OPTIONS[0].key);
  const [confirmState, setConfirmState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setPending(new Map());
    setFeedback(null);
  }, [report?.id]);

  const items = useMemo(() => {
    const important = report?.importantItems || [];
    const action = report?.actionRequiredItems || [];
    const byId = new Map();
    for (const item of [...important, ...action]) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }, [report]);

  const decisionsByItem = useMemo(() => {
    const map = new Map();
    for (const row of report?.decisions || []) {
      if (row?.itemId) map.set(row.itemId, row);
    }
    return map;
  }, [report]);

  const sortedItems = useMemo(() => {
    const filter = (list) => {
      if (sortKey === "all") return list;
      if (sortKey === "pending") {
        return list.filter((item) => !decisionsByItem.has(item.id));
      }
      if (sortKey === "urgent") {
        return [...list].sort((a, b) => (PRIORITY_ORDER[a.priority ?? "reference"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "reference"] ?? 2));
      }
      return list.filter((item) => (item.priority || "reference") === sortKey);
    };
    return filter(items);
  }, [items, sortKey, decisionsByItem]);

  const togglSelect = useCallback((itemId) => {
    if (!itemId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const pickDecision = useCallback((itemId, decision, savedDecision) => {
    if (!itemId) return;
    setPending((prev) => {
      const next = new Map(prev);
      if (decision === savedDecision) next.delete(itemId);
      else next.set(itemId, decision);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allVisibleSelected = sortedItems.length > 0
        && sortedItems.every((item) => prev.has(item.id));
      return allVisibleSelected ? new Set() : new Set(sortedItems.map((item) => item.id));
    });
  }, [sortedItems]);

  const saveDecisions = useCallback(async (decisionsPayload, successMessage) => {
    if (!report?.id || decisionsPayload.length === 0) return false;
    setSaving(true);
    try {
      const { data } = await api.post(`/api/admin/email-reports/${report.id}/decisions`, { decisions: decisionsPayload });
      setPending((prev) => {
        const next = new Map(prev);
        for (const d of decisionsPayload) next.delete(d.itemId);
        return next;
      });
      setFeedback({ tone: "ok", message: successMessage || `${data.savedCount}건 저장되었습니다.` });
      onRefresh?.();
      return true;
    } catch (err) {
      setFeedback({ tone: "error", message: errorMessage(err, "결정 저장에 실패했습니다.") });
      return false;
    } finally {
      setSaving(false);
    }
  }, [report?.id, onRefresh]);

  const pendingCount = pending.size;
  const selectedCount = selectedIds.size;

  const applyBulk = useCallback(() => {
    if (!selectedCount) return;
    const payload = Array.from(selectedIds).map((itemId) => ({ itemId, decision: bulkChoice }));
    setConfirmState({
      title: "일괄 결정을 적용할까요?",
      body: `${selectedCount}건의 메일에 "${DECISION_LABELS[bulkChoice]}" 결정을 저장합니다. 실제 메일함에서 삭제/보존은 실행되지 않고 결정만 기록됩니다.`,
      confirmLabel: "결정 저장",
      onConfirm: async () => {
        const ok = await saveDecisions(payload, `${selectedCount}건에 일괄 결정이 저장되었습니다.`);
        if (ok) setSelectedIds(new Set());
        setConfirmState(null);
      },
    });
  }, [bulkChoice, saveDecisions, selectedCount, selectedIds]);

  const savePending = useCallback(() => {
    if (!pendingCount) return;
    const payload = Array.from(pending.entries()).map(([itemId, decision]) => ({ itemId, decision }));
    setConfirmState({
      title: "대기 중인 결정을 저장할까요?",
      body: `${pendingCount}건의 결정을 저장합니다. 메일함 작업은 실행되지 않습니다.`,
      confirmLabel: "저장",
      onConfirm: async () => {
        await saveDecisions(payload);
        setConfirmState(null);
      },
    });
  }, [pending, pendingCount, saveDecisions]);

  const clearDecision = useCallback(async (itemId, hasSaved, hasPending) => {
    if (!itemId) return;
    if (hasPending || !hasSaved) {
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      return;
    }
    setConfirmState({
      title: "저장된 결정을 취소할까요?",
      body: "선택한 메일의 저장된 결정을 삭제합니다. 메일함 작업은 실행되지 않습니다.",
      confirmLabel: "결정 삭제",
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.delete(`/api/admin/email-reports/${report.id}/decisions`, { params: { itemId } });
          setFeedback({ tone: "ok", message: "결정이 삭제되었습니다." });
          onRefresh?.();
        } catch (err) {
          setFeedback({ tone: "error", message: errorMessage(err, "결정 삭제에 실패했습니다.") });
        } finally {
          setSaving(false);
          setConfirmState(null);
        }
      },
    });
  }, [report?.id, onRefresh]);

  if (loading) return <div className={styles.detailState}><span className={styles.spinner} />보고서를 불러오는 중입니다.</div>;
  if (error) {
    return (
      <div className={styles.detailErrorState} role="alert">
        <p>{error}</p>
        <div>
          <button type="button" onClick={onBack}>목록으로</button>
          <button type="button" onClick={onRefresh}>다시 시도</button>
        </div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className={styles.detailPlaceholder}>
        <div className={styles.placeholderIcon}>✉</div>
        <h2>보고서를 선택해 주세요</h2>
        <p>날짜별 메일 의사결정 목록과 우선순위 요약을 안전하게 확인할 수 있습니다.</p>
      </div>
    );
  }

  const counts = report.totalCounts || {};
  const summary = report.summaryCounts || {};
  const cleanup = report.cleanupResults || {};
  const accounts = report.accountSummaries || [];
  const allSelected = sortedItems.length > 0 && sortedItems.every((item) => selectedIds.has(item.id));

  return (
    <div className={styles.detailContent}>
      <button className={styles.mobileBack} type="button" onClick={onBack}>← 목록으로</button>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.eyebrow}>{report.reportKey}</span>
          <h2>{formatDate(report.reportDate)} 이메일 의사결정</h2>
          <p>{report.metadata?.source || "자동 수집"} · 생성 {formatDate(report.metadata?.generatedAt, true)}</p>
        </div>
        <span className={styles.safeBadge}>요약·판단 정보만 저장</span>
      </header>

      <div className={styles.digestStrip} role="list" aria-label="오늘의 핵심 요약">
        <Metric
          label="즉시 처리"
          value={summary.immediate}
          tone="rose"
          title="아직 결정이 없는 긴급·오늘 처리 대상 메일"
        />
        <Metric
          label="검토"
          value={summary.review}
          tone="amber"
          title="아직 결정이 없는 중요 메일"
        />
        <Metric
          label="자동화 후보"
          value={summary.automation}
          tone="cyan"
          title="자동 규칙(자동 보관·자동 삭제 등)이 권장되는 메일"
        />
      </div>

      <div className={styles.metrics} role="list">
        <Metric label="전체 메일" value={counts.total} />
        <Metric label="중요 메일" value={counts.important} tone="violet" />
        <Metric label="조치 필요" value={counts.actionRequired} tone="amber" />
        <Metric label="정리 완료" value={counts.cleaned} tone="green" />
      </div>

      <div className={styles.summaryStrip} role="list" aria-label="추가 지표">
        <Metric label="오늘 처리" value={summary.todayActionable} tone="amber" title="긴급 또는 오늘 안 처리가 필요한 메일" />
        <Metric label="마감 임박" value={summary.deadlineSoon} tone="amber" title="3일 이내 마감이 있는 메일" />
        <Metric label="결제/보안/계정" value={summary.paymentOrSecurityRisk} tone="rose" title="결제·보안·계정 위험 신호" />
        <Metric label="삭제 추천" value={summary.deletionSuggested} tone="slate" title="삭제가 권장되는 메일" />
        <Metric label="자동화 추천" value={summary.automationSuggested} tone="cyan" title="자동 규칙 전환이 권장되는 메일" />
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

      <section className={styles.section} aria-labelledby="email-decisions-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="email-decisions-heading">우선순위별 의사결정 목록</h3>
            <p>항목별 핵심 사실과 권장 조치를 확인한 뒤 결정을 기록하세요. 실제 메일함 변경은 실행되지 않고 결정만 저장됩니다.</p>
          </div>
          <div className={styles.listControls} role="toolbar" aria-label="정렬과 전체 선택">
            <label className={styles.sortLabel}>
              <span>정렬</span>
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value);
                  setSelectedIds(new Set());
                }}
                aria-label="정렬 기준"
              >
                {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className={styles.selectAllButton}
              onClick={toggleAll}
              disabled={sortedItems.length === 0}
              aria-pressed={allSelected}
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`${styles.feedback} ${feedback.tone === "error" ? styles.feedbackError : styles.feedbackOk}`}
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live={feedback.tone === "error" ? "assertive" : "polite"}
          >
            {feedback.message}
          </div>
        )}

        {(selectedCount > 0 || pendingCount > 0) && (
          <div className={styles.bulkBar} role="region" aria-label="일괄 결정 도구">
            {selectedCount > 0 && (
              <div className={styles.bulkGroup}>
                <span>{selectedCount}건 선택</span>
                <select value={bulkChoice} onChange={(e) => setBulkChoice(e.target.value)} aria-label="일괄 적용할 결정">
                  {DECISION_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <button type="button" onClick={applyBulk} disabled={saving} className={styles.bulkApply}>
                  일괄 적용
                </button>
              </div>
            )}
            {pendingCount > 0 && (
              <div className={styles.bulkGroup}>
                <span>저장 대기 {pendingCount}건</span>
                <button type="button" onClick={savePending} disabled={saving} className={styles.bulkApply}>
                  대기 결정 저장
                </button>
              </div>
            )}
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className={styles.sectionEmpty}>조건에 맞는 메일이 없습니다.</div>
        ) : (
          <div className={styles.itemList}>
            {sortedItems.map((item) => (
              <DecisionItem
                key={item.id}
                item={item}
                decision={decisionsByItem.get(item.id) || null}
                pendingDecision={pending.get(item.id) ?? null}
                selected={selectedIds.has(item.id)}
                onToggleSelect={togglSelect}
                onPickDecision={pickDecision}
                onClearDecision={clearDecision}
                saving={saving}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.cleanupCard}>
        <div><span>보관</span><strong>{Number(cleanup.archived || 0).toLocaleString("ko-KR")}건</strong></div>
        <div><span>삭제함 이동</span><strong>{Number(cleanup.deleted || 0).toLocaleString("ko-KR")}건</strong></div>
        <div><span>건너뜀</span><strong>{Number(cleanup.skipped || 0).toLocaleString("ko-KR")}건</strong></div>
        <p>{cleanup.notes || "정리 메모가 없습니다."}</p>
      </section>

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || ""}
        body={confirmState?.body || ""}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
        busy={saving}
      />
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
  const [detailError, setDetailError] = useState({ reportId: null, message: "" });
  const [detailReload, setDetailReload] = useState(0);
  const [listReload, setListReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/api/admin/email-reports?page=${page}&size=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ data }) => {
        setList(data);
        setListError("");
      })
      .catch((error) => {
        if (error.code !== "ERR_CANCELED") setListError("보고서 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [page, listReload]);

  useEffect(() => {
    if (!reportId) return undefined;
    const controller = new AbortController();
    api.get(`/api/admin/email-reports/${reportId}`, { signal: controller.signal })
      .then(({ data }) => {
        setDetail(data);
        setDetailError({ reportId, message: "" });
      })
      .catch((error) => {
        if (error.code !== "ERR_CANCELED") {
          setDetail(null);
          setDetailError({
            reportId,
            message: error.response?.status === 404
              ? "보고서를 찾을 수 없습니다."
              : "보고서 상세를 불러오지 못했습니다.",
          });
        }
      });
    return () => controller.abort();
  }, [reportId, detailReload]);

  const selectedDetail = reportId && detail?.id === Number(reportId) ? detail : null;
  const selectedError = detailError.reportId === reportId ? detailError.message : "";
  const selectedLoading = Boolean(reportId) && !selectedDetail && !selectedError;
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
          <h1>이메일 의사결정 보고서</h1>
          <p>우선순위별 메일 요약과 권장 조치를 확인하고, 각 메일의 처리 결정을 안전하게 기록합니다.</p>
        </div>
        <div className={styles.privacyNote}>
          <span aria-hidden="true">✓</span>
          <span>원문 본문·첨부·인증정보는 저장하지 않습니다. 요약과 판단에 필요한 최소 정보와 관리자 결정만 기록합니다.</span>
        </div>
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
                    navigate(`/admin/email-reports/${item.id}`);
                  }}
                  aria-current={Number(reportId) === item.id ? "page" : undefined}
                >
                  <div className={styles.rowTop}><strong>{formatDate(item.reportDate)}</strong><span>{item.reportKey}</span></div>
                  <div className={styles.rowMetrics}>
                    <span>전체 <b>{Number(item.totalCounts?.total || 0).toLocaleString("ko-KR")}</b></span>
                    <span>중요 <b>{Number(item.totalCounts?.important || 0).toLocaleString("ko-KR")}</b></span>
                    <span className={styles.actionMetric}>조치 <b>{Number(item.totalCounts?.actionRequired || 0).toLocaleString("ko-KR")}</b></span>
                  </div>
                  <div className={styles.rowSummary}>
                    <span>즉시 {Number(item.summaryCounts?.immediate ?? item.summaryCounts?.todayActionable ?? 0).toLocaleString("ko-KR")}</span>
                    <span>검토 {Number(item.summaryCounts?.review || 0).toLocaleString("ko-KR")}</span>
                    <span>자동화 {Number(item.summaryCounts?.automation ?? item.summaryCounts?.automationSuggested ?? 0).toLocaleString("ko-KR")}</span>
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
            error={selectedError}
            onBack={() => navigate("/admin/email-reports")}
            onRefresh={() => {
              setDetailReload((n) => n + 1);
              setListReload((n) => n + 1);
            }}
          />
        </main>
      </div>
    </div>
  );
}
