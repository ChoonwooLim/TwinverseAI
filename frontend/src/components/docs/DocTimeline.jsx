import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildIndex, isTableDoc } from "../../utils/docEntries";
import styles from "./DocTimeline.module.css";

/** 연/월 필터는 한 번에 하나만 활성이다. null이면 전체. */
function matchesFilter(group, filter) {
  if (!filter) return true;
  if (group.year === null) return false;
  if (filter.month) return group.year === filter.year && group.month === filter.month;
  return group.year === filter.year;
}

function groupLabel(group) {
  if (group.year === null) return "날짜 미상";
  return `${group.year}년 ${group.month}월`;
}

/** 카드 안쪽. 작업일지는 링크로, 표형은 버튼으로 감싸므로 내용만 따로 둔다. */
function CardInner({ group }) {
  const entry = group.entries[0];
  // 제목 → 본문에서 뽑은 요약 → 아무것도 없음.
  // 날짜는 이미 왼쪽 cardDate에 찍히므로 폴백으로 쓰지 않는다(같은 날짜를 두 번 읽게 된다).
  const label = entry.title || entry.summary || "";
  return (
    <>
      <span className={styles.cardDate}>{group.date.slice(5) || "—"}</span>
      <span className={styles.cardBody}>
        {label && <span className={styles.cardTitle}>{label}</span>}
        {group.entries.length > 1 && (
          <span className={styles.badge}>{group.entries.length}건</span>
        )}
      </span>
    </>
  );
}

export default function DocTimeline({ docKey, groups, filter, onFilterChange }) {
  const [openDate, setOpenDate] = useState(null);
  const index = useMemo(() => buildIndex(groups), [groups]);

  // 필터는 AdminDocs가 들고 있다 — 상세로 갔다 돌아와도 유지되어야 하는데
  // 이 컴포넌트는 그때 언마운트된다. 펼침 상태(openDate)는 표형 전용이고 표형은
  // 상세로 가지 않으므로 로컬로 둔다.
  const setFilter = (next) => {
    onFilterChange(next);
    setOpenDate(null);
  };

  const visible = groups.filter((g) => matchesFilter(g, filter));
  // 표형 문서(fields 보유)는 페이지 이동 없이 그 자리에서 펼친다.
  const tableDoc = isTableDoc(groups);

  return (
    <div className={styles.timeline}>
      <nav className={styles.index} aria-label="연월 인덱스">
        {index.map((year) => (
          <div key={year.year} className={styles.yearBlock}>
            <button
              type="button"
              className={`${styles.yearBtn} ${filter?.year === year.year && !filter?.month ? styles.active : ""}`}
              onClick={() =>
                setFilter(filter?.year === year.year && !filter?.month ? null : { year: year.year })
              }
            >
              <span>{year.year}</span>
              <span className={styles.count}>{year.count}</span>
            </button>
            {year.months.map((m) => (
              <button
                key={m.month}
                type="button"
                className={`${styles.monthBtn} ${filter?.year === year.year && filter?.month === m.month ? styles.active : ""}`}
                onClick={() =>
                  setFilter(
                    filter?.year === year.year && filter?.month === m.month
                      ? null
                      : { year: year.year, month: m.month }
                  )
                }
              >
                <span>{String(m.month).padStart(2, "0")}월</span>
                <span className={styles.count}>{m.count}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.stream}>
        {visible.length === 0 && <p className={styles.empty}>해당 기간의 기록이 없습니다.</p>}
        {visible.map((group, i) => {
          // 월이 바뀌는 첫 카드 위에만 헤더를 찍는다.
          const label = groupLabel(group);
          const showLabel = i === 0 || groupLabel(visible[i - 1]) !== label;
          const heading = showLabel && <h2 className={styles.monthHeading}>{label}</h2>;

          // 표형 문서(fields 보유)는 날짜 유무와 무관하게 그 자리에서 펼친다 —
          // 날짜 미상이라도 fields는 펼치지 않으면 영영 볼 수 없다.
          if (tableDoc) {
            return (
              <div key={group.date || "unknown"}>
                {heading}
                <button
                  type="button"
                  className={styles.card}
                  aria-expanded={openDate === group.date}
                  onClick={() => setOpenDate(openDate === group.date ? null : group.date)}
                >
                  <CardInner group={group} />
                </button>
                {openDate === group.date && (
                  <div className={styles.detail}>
                    {group.entries.map((entry, j) => (
                      <dl key={j} className={styles.fields}>
                        {group.entries.length > 1 && (
                          <div className={styles.fieldRow}>
                            <dt className={styles.fieldLabel}>항목</dt>
                            <dd className={styles.fieldValue}>{entry.title}</dd>
                          </div>
                        )}
                        {entry.fields.map((f) => (
                          <div key={f.label} className={styles.fieldRow}>
                            <dt className={styles.fieldLabel}>{f.label}</dt>
                            <dd className={styles.fieldValue}>{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // 여기까지 온 그룹은 섹션형이다. 섹션 헤딩 정규식이 ISO 날짜를 요구하므로
          // 섹션형 엔트리에는 날짜 미상이 존재할 수 없고, 날짜 미상 그룹은 표형에서만
          // 나와 위 tableDoc 분기가 이미 가져간다 — 링크가 항상 유효한 날짜를 가리킨다.
          return (
            <div key={group.date}>
              {heading}
              <Link to={`/admin/docs/${docKey}/${group.date}`} className={styles.card}>
                <CardInner group={group} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
