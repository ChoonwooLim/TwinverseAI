/**
 * 연·월·일 타임라인으로 렌더할 문서 목록.
 *
 * 문서 내용을 보고 자동 판별하지 않는다. 타임라인이 걸리면 그 문서는 날짜 엔트리만
 * 렌더되고 나머지 산문이 통째로 화면에서 사라지는데, `날짜` 컬럼을 가진 표 하나만
 * 있으면 걸려들던 이전 판별식으로는 `dev-plan.md`처럼 마일스톤 표를 가진 일반 문서가
 * /end 의 컬럼 이름 변경 한 번에 본문을 잃을 수 있었다.
 *
 * 목록에 없는 문서는 이 브랜치 이전과 100% 동일하게 통짜 마크다운으로 렌더된다.
 * 새 로그 문서를 타임라인에 태우려면 여기에 키 한 줄만 추가하면 된다.
 */
export const TIMELINE_DOC_KEYS = ["work-log", "bugfix-log", "upgrade-log"];

/**
 * @param {string|undefined} docKey
 * @returns {boolean}
 */
export function isTimelineDoc(docKey) {
  return TIMELINE_DOC_KEYS.includes(docKey);
}
