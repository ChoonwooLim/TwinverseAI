/**
 * 프로젝트 문서(마크다운)를 날짜 엔트리 배열로 정규화한다.
 * 순수 함수만 둔다 — DOM·네트워크 의존 없음.
 *
 * @typedef {Object} DocEntry
 * @property {string} date   원본 날짜 문자열. ISO가 아니면 year/month가 null이 된다.
 * @property {number|null} year
 * @property {number|null} month
 * @property {string} title
 * @property {string} summary  제목이 없는 섹션형 엔트리의 본문 유래 요약. 그 외에는 ""
 * @property {string} body   섹션형 본문 마크다운. 표형은 ""
 * @property {{label: string, value: string}[]|null} fields  표형 상세. 섹션형은 null
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// 날짜 뒤에 무엇이 오든(괄호가 닫히지 않아도) 항상 섹션 경계로 인식한다.
// 제목 추출(괄호 안 문구 vs 전체 문구)은 별도로 처리한다.
const SECTION_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*(.*)$/;
const PAREN_TITLE = /^\((.*)\)$/;

/** 본문 끝의 빈 줄과 `---` 구분선을 걷어낸다. */
function stripTrailingRule(text) {
  const lines = text.split("\n");
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (last === "" || last === "---") lines.pop();
    else break;
  }
  return lines.join("\n").trim();
}

/** `| a | b |` 형태 줄인가 */
function isTableRow(line) {
  return line.trim().startsWith("|");
}

/** `|---|---|` 형태 구분줄인가 */
function isSeparatorRow(line) {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes("-");
}

/**
 * `| a | b |` → ["a", "b"]
 * GFM 표기법상 셀 안의 파이프는 `\|`로 이스케이프된다(코드 조각·셸 파이프 등).
 * 백슬래시가 앞에 오지 않는 `|`만 구분자로 삼고, 분리 후 `\|`를 실제 `|`로 되돌린다.
 */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** `- 항목` / `* 항목` / `1. 항목` 목록 줄에서 항목 본문만 뽑는다. */
const BULLET_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(\S.*)$/;

/** 카드 한 줄에 들어갈 요약의 최대 길이. 넘치면 말줄임한다. */
const SUMMARY_MAX = 60;

/**
 * 마크다운 표기를 걷어내 한 줄 평문으로 만든다.
 * 카드 제목은 마크다운으로 렌더하지 않으므로 `**`·백틱이 그대로 보이면 안 된다.
 * `_`는 식별자(`COOKIE_SECURE` 등)에 흔해 강조로 보지 않고 남겨둔다.
 */
function toPlainText(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // 이미지는 통째로 제거
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // 링크는 라벨만 남긴다
    .replace(/[`*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 제목이 없는 섹션(`## YYYY-MM-DD` 단독)의 카드 라벨로 쓸 요약을 본문에서 뽑는다.
 *
 * 작업일지 섹션은 대개 `### 작업 요약` 표로 시작하고 그 행에 작업 내용이 들어 있다.
 * 표 대신 목록으로 적는 섹션도 있어 둘 다 받는다 — 본문에서 먼저 나오는 쪽의 첫 항목이
 * 그 날의 첫 작업이다. 표에서는 `내용`이 든 컬럼(작업 내용·변경 내용)을 쓰고, 없으면
 * 두 번째 컬럼을 쓴다(첫 컬럼은 대개 `카테고리` 같은 분류값이라 요약이 되지 못한다).
 *
 * 둘 다 없으면 "" — 카드에 날짜를 제목 자리에 한 번 더 찍는 일은 하지 않는다.
 *
 * @param {string} body 섹션 본문 마크다운
 * @returns {string} 평문 요약. 없으면 ""
 */
export function deriveSummary(body) {
  if (!body) return "";
  const lines = body.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 표 머리(헤더 + 구분줄 + 데이터 행 하나 이상)를 만나면 첫 데이터 행에서 뽑는다.
    if (
      isTableRow(line) &&
      i + 2 < lines.length &&
      isSeparatorRow(lines[i + 1]) &&
      isTableRow(lines[i + 2])
    ) {
      const headers = splitRow(line);
      const cells = splitRow(lines[i + 2]);
      let col = headers.findIndex((h) => h.includes("내용"));
      if (col === -1) col = headers.length > 1 ? 1 : 0;
      const value = toPlainText(cells[col] || "");
      if (value) return clampSummary(value);
    }

    const bullet = BULLET_ITEM.exec(line);
    if (bullet) {
      const value = toPlainText(bullet[1]);
      if (value) return clampSummary(value);
    }
  }

  return "";
}

function clampSummary(text) {
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX).trimEnd()}…` : text;
}

/**
 * `## YYYY-MM-DD (제목)` 섹션 문서를 엔트리로 분해한다. (작업일지)
 * @param {string} md
 * @returns {DocEntry[]}
 */
export function parseSectionDoc(md) {
  if (!md) return [];

  const entries = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const [, year, month] = ISO_DATE.exec(current.date);
    const body = stripTrailingRule(current.lines.join("\n"));
    entries.push({
      date: current.date,
      year: Number(year),
      month: Number(month),
      title: current.title,
      // 제목이 없는 섹션만 본문에서 요약을 뽑는다. 제목이 있으면 그쪽이 항상 낫다.
      summary: current.title ? "" : deriveSummary(body),
      body,
      fields: null,
    });
    current = null;
  };

  for (const line of md.split(/\r?\n/)) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      flush();
      const rest = (heading[2] || "").trim();
      const paren = PAREN_TITLE.exec(rest);
      const title = paren ? paren[1].trim() : rest;
      current = { date: heading[1], title, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return entries;
}

/**
 * 마크다운 표 문서를 엔트리로 분해한다. (버그수정·업그레이드 로그)
 * 첫 번째 표만 읽는다. `날짜` 컬럼 다음 컬럼이 제목, 나머지는 fields.
 * @param {string} md
 * @returns {DocEntry[]}
 */
export function parseTableDoc(md) {
  if (!md) return [];
  const lines = md.split(/\r?\n/);

  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (isTableRow(lines[i]) && isSeparatorRow(lines[i + 1])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = splitRow(lines[headerIdx]);
  const dateCol = headers.findIndex((h) => h.includes("날짜"));
  if (dateCol === -1) return [];
  const titleCol = dateCol + 1 < headers.length ? dateCol + 1 : -1;

  const entries = [];
  for (let i = headerIdx + 2; i < lines.length; i += 1) {
    // 표 중간의 빈 줄은 표를 끝내지 않는다. 자동 기록기가 행 사이에 빈 줄을 하나 남기는
    // 것만으로 그 아래 전 행이 조용히 사라지던 문제를 막는다.
    // 한계(수용): 표 중간의 산문 한 줄은 여전히 표의 끝으로 본다. 표 아래 이어지는 본문과
    // 표 안의 오타를 구분할 방법이 없어, 뒤쪽 산문을 행으로 오인해 쓰레기 엔트리를 만드는
    // 것보다 여기서 멈추는 편이 안전하다.
    if (!isTableRow(lines[i])) {
      if (lines[i].trim() === "") continue;
      break; // 표 끝
    }
    // 빈 줄을 건너뛰게 되면서 빈 줄 너머의 "다음 표"까지 걸어 들어갈 수 있게 됐다.
    // 구분줄(|---|---|)은 표 머리에만 나오므로 그 자체가 새 표의 신호이고, 구분줄이
    // 뒤따르는 행은 새 표의 헤더다. 헤더가 한 박자 먼저 오므로 둘 다 막아야
    // `날짜`·`------` 같은 쓰레기 엔트리가 생기지 않는다.
    if (isSeparatorRow(lines[i])) break;
    if (i + 1 < lines.length && isSeparatorRow(lines[i + 1])) break;
    const cells = splitRow(lines[i]);
    const rawDate = cells[dateCol] || "";
    const iso = ISO_DATE.exec(rawDate);

    entries.push({
      date: rawDate,
      year: iso ? Number(iso[1]) : null,
      month: iso ? Number(iso[2]) : null,
      title: titleCol >= 0 ? cells[titleCol] || "" : "",
      // 표형은 날짜 다음 컬럼이 늘 제목이라 본문 유래 요약이 필요 없다. 형태만 맞춘다.
      summary: "",
      body: "",
      fields: headers
        .map((label, idx) =>
          idx === dateCol || idx === titleCol ? null : { label, value: cells[idx] || "" }
        )
        // 값이 빈 셀은 상세 뷰에 "라벨: (빈칸)"으로 노이즈만 남기므로 의도적으로 제외한다.
        .filter((f) => f && f.value),
    });
  }

  return entries;
}

/**
 * 문서 형태를 자동 판별해 엔트리를 뽑는다.
 * 날짜 엔트리가 하나도 없으면 null — 호출부는 기존 통짜 렌더로 fallback한다.
 * @param {string} md
 * @returns {DocEntry[]|null}
 */
export function parseDoc(md) {
  if (!md) return null;
  const sections = parseSectionDoc(md);
  if (sections.length) return sections;
  const rows = parseTableDoc(md);
  if (rows.length) return rows;
  return null;
}

/**
 * @typedef {Object} DayGroup
 * @property {string} date
 * @property {number|null} year
 * @property {number|null} month
 * @property {DocEntry[]} entries
 */

/**
 * 같은 날짜 엔트리를 하나의 날 그룹으로 묶고 날짜 내림차순으로 정렬한다.
 * 날짜가 없는 엔트리는 버리지 않고 맨 뒤 "미상" 그룹으로 모은다.
 * @param {DocEntry[]} entries
 * @returns {DayGroup[]}
 */
export function groupByDate(entries) {
  const byKey = new Map();

  for (const entry of entries) {
    const key = entry.year === null ? " unknown" : entry.date;
    if (!byKey.has(key)) {
      byKey.set(
        key,
        entry.year === null
          ? { date: "", year: null, month: null, entries: [] }
          : { date: entry.date, year: entry.year, month: entry.month, entries: [] }
      );
    }
    byKey.get(key).entries.push(entry);
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.date.localeCompare(a.date);
  });
}

/**
 * 표형 문서인가 — 표형 엔트리만 `fields` 배열을 갖는다(섹션형은 항상 null).
 * 표형은 엔트리 본문(`body`)이 비어 있어 하루 상세 페이지를 만들 재료가 없다.
 * 화면 분기가 두 군데(AdminDocs·DocTimeline)라 판별을 여기 한 곳에 둔다.
 * @param {DayGroup[]} groups
 * @returns {boolean}
 */
export function isTableDoc(groups) {
  return groups.some((g) => g.entries.some((e) => Array.isArray(e.fields)));
}

/**
 * @typedef {Object} YearIndex
 * @property {number} year
 * @property {number} count   그 해의 날 그룹 수
 * @property {{month: number, count: number}[]} months
 */

/**
 * 좌측 연/월 인덱스용 집계. 날짜 미상 그룹은 제외한다.
 * @param {DayGroup[]} groups
 * @returns {YearIndex[]}
 */
export function buildIndex(groups) {
  const byYear = new Map();

  for (const group of groups) {
    if (group.year === null) continue;
    if (!byYear.has(group.year)) byYear.set(group.year, { count: 0, months: new Map() });
    const year = byYear.get(group.year);
    year.count += 1;
    year.months.set(group.month, (year.months.get(group.month) || 0) + 1);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, data]) => ({
      year,
      count: data.count,
      months: [...data.months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, count]) => ({ month, count })),
    }));
}
