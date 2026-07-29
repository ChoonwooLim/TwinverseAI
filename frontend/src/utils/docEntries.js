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
const SECTION_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})(?:\s*\((.*)\))?\s*$/;

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
      current = { date: heading[1], title: (heading[2] || "").trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return entries;
}
