/**
 * 프로젝트 문서(마크다운)를 날짜 엔트리 배열로 정규화한다.
 * 순수 함수만 둔다 — DOM·네트워크 의존 없음.
 *
 * @typedef {Object} DocEntry
 * @property {string} date   원본 날짜 문자열. ISO가 아니면 year/month가 null이 된다.
 * @property {number|null} year
 * @property {number|null} month
 * @property {string} title
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
    entries.push({
      date: current.date,
      year: Number(year),
      month: Number(month),
      title: current.title,
      body: stripTrailingRule(current.lines.join("\n")),
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
    if (!isTableRow(lines[i])) break; // 표 끝
    const cells = splitRow(lines[i]);
    const rawDate = cells[dateCol] || "";
    const iso = ISO_DATE.exec(rawDate);

    entries.push({
      date: rawDate,
      year: iso ? Number(iso[1]) : null,
      month: iso ? Number(iso[2]) : null,
      title: titleCol >= 0 ? cells[titleCol] || "" : "",
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
