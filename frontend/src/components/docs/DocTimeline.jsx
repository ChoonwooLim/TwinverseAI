import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildIndex } from "../../utils/docEntries";
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
  return (
    <>
      <span className={styles.cardDate}>{group.date.slice(5) || "—"}</span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>
          {group.entries[0].title || group.date || "제목 없음"}
        </span>
        {group.entries.length > 1 && (
          <span className={styles.badge}>{group.entries.length}건</span>
        )}
      </span>
    </>
  );
}

export default function DocTimeline({ docKey, groups }) {
  const [filter, setFilter] = useState(null);
  const index = useMemo(() => buildIndex(groups), [groups]);

  const visible = groups.filter((g) => matchesFilter(g, filter));

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
          // 날짜 미상 그룹은 이동할 곳이 없다 — 링크가 아닌 정적 카드로 렌더한다.
          if (group.year === null) {
            return (
              <div key={group.date || "unknown"}>
                {showLabel && <h2 className={styles.monthHeading}>{label}</h2>}
                <div className={`${styles.card} ${styles.cardStatic}`}>
                  <CardInner group={group} />
                </div>
              </div>
            );
          }
          return (
            <div key={group.date || "unknown"}>
              {showLabel && <h2 className={styles.monthHeading}>{label}</h2>}
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
