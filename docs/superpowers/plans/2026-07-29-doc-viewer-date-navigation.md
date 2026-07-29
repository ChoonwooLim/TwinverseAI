# 프로젝트 문서 뷰어 연/월/일 내비게이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 프로젝트 문서(`/admin/docs/*`)에서 로그성 문서를 연·월·일로 탐색할 수 있게 한다. 작업일지 136KB가 한 페이지에 통째로 렌더되는 현상을 없앤다.

**Architecture:** 프론트엔드 순수 함수(`docEntries.js`)가 마크다운 content를 파싱해 날짜 엔트리 배열로 정규화한다. 작업일지는 `## YYYY-MM-DD` 섹션, 버그수정·업그레이드 로그는 마크다운 표 행이 엔트리 단위다. 화면은 타임라인 목록(기본)과 날짜 상세로 나뉜다. `.md` 원본·백엔드·DB·`/end` 스킬은 일절 수정하지 않는다.

**Tech Stack:** React 19, react-router-dom, react-markdown + remark-gfm, CSS Modules, vitest(신규)

**설계 문서:** [`docs/superpowers/specs/2026-07-29-doc-viewer-date-navigation-design.md`](../specs/2026-07-29-doc-viewer-date-navigation-design.md)

## Global Constraints

- **`docs/*.md` 원본을 수정하지 않는다.** 날짜 정렬 교정은 화면에서만 일어난다.
- **`backend/` 전체를 수정하지 않는다.** `_seed_docs()`, `routers/docs.py`, `models/document.py` 무수정.
- **`.claude/skills/end/SKILL.md`(/end 스킬)를 수정하지 않는다.**
- **전역 `frontend/src/components/layout/Sidebar.jsx`를 수정하지 않는다.** 연/월 인덱스는 문서 페이지 안에 둔다.
- **파싱 실패 시 반드시 기존 통짜 렌더로 fallback한다.** 개발계획·Orbitron 서버·픽셀스트리밍 서버 등 날짜 없는 문서는 현재와 100% 동일하게 동작해야 한다.
- **연/월 필터는 한 번에 하나만 활성.** 연+월 조합 상태를 만들지 않는다.
- 커밋 메시지 접두어: `feat:` / `fix:` / `style:` / `refactor:` / `docs:` / `infra:`
- 컴포넌트 파일 컨벤션: `components/<group>/Name.jsx` + `Name.module.css` 콜로케이션.

## 설계 문서 대비 의도적 변경 2건

### 1. 라우트는 추가가 아니라 옵셔널 파라미터로

설계 문서 3장은 `/admin/docs/:docKey/:date` 라우트를 **추가**하라고 썼다. 대신 기존
`/admin/docs/:docKey`를 `/admin/docs/:docKey/:date?`로 **교체**한다. 라우트를 둘로 나누면
목록↔상세 이동 때 `AdminDocs`가 언마운트돼 136KB content를 매번 다시 받는다. 옵셔널
파라미터(react-router 7.14 지원)면 같은 라우트 안에서 파라미터만 바뀌므로 재요청이 없다.
결과 URL은 설계 문서와 동일하다.

### 2. 테스트는 고정 개수 대신 불변식으로

설계 문서 5장 테스트 표의 **"작업일지 섹션 파싱 → 엔트리 29개"** 를 그대로 구현하지 않는다.
작업일지는 `/end` 실행마다 섹션이 늘어나므로 29라는 고정 숫자에 assert하면 다음 세션에
반드시 깨지는 테스트가 된다. 대신:

- 개수·제목·병합 검증 → **테스트 파일에 인라인한 발췌 fixture**로 (숫자가 고정됨)
- 실제 `docs/work-log.md` → **불변식 검증**으로 (엔트리 ≥ 1, 모든 date가 ISO 형식, 그룹이 내림차순)

이쪽이 문서가 커져도 계속 유효하다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `frontend/src/utils/docEntries.js` | **신규.** 마크다운 → 엔트리 배열 파싱, 날짜 그룹핑, 연/월 인덱스 생성. 순수 함수만. DOM·API 의존 없음 |
| `frontend/src/utils/docEntries.test.js` | **신규.** 위 함수들의 유닛 테스트 |
| `frontend/src/components/docs/DocTimeline.jsx` | **신규.** 좌측 연/월 인덱스 + 우측 카드 목록. 표형 카드의 인라인 확장 포함 |
| `frontend/src/components/docs/DocTimeline.module.css` | **신규.** 위 스타일 |
| `frontend/src/components/docs/DocDayDetail.jsx` | **신규.** 특정 날짜의 섹션 본문 렌더 + breadcrumb + 이전/다음 날 이동 |
| `frontend/src/components/docs/DocDayDetail.module.css` | **신규.** 위 레이아웃 스타일. 마크다운 본문 스타일은 아래 prose 모듈에 맡긴다 |
| `frontend/src/styles/prose.module.css` | **신규(Task 5).** 마크다운 본문 공용 스타일. `AdminDocs.module.css`의 `.content` 자식 규칙을 **옮겨온다** — 복사가 아니라 이동 |
| `frontend/src/pages/admin/AdminDocs.jsx` | **수정.** content fetch → `parseDoc` → 타임라인/상세/fallback 분기 |
| `frontend/src/pages/admin/AdminDocs.module.css` | **수정.** `.page` 최대폭 확대, summary·스켈레톤 추가, `.content` 자식 규칙은 prose로 이관 |
| `frontend/src/App.jsx` | **수정.** 기존 `/admin/docs/:docKey` 라우트를 `:date?` 옵셔널 파라미터로 확장 (1줄 교체) |
| `frontend/package.json` | **수정.** `vitest` devDep + `test` 스크립트 |

**UI 테스트 범위:** 파서는 유닛 테스트로 덮고, 화면은 `npm run build` + 브라우저 수동 확인으로 검증한다. `@testing-library/react` + `jsdom` 도입은 이번 범위에 넣지 않는다 — 회귀 위험이 파서에 집중돼 있고, 컴포넌트 테스트 인프라는 별도 결정 사항이다.

---

### Task 1: 테스트 러너 도입 + 섹션 파서

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/utils/docEntries.js`
- Test: `frontend/src/utils/docEntries.test.js`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `parseSectionDoc(md: string) => DocEntry[]`
  - `DocEntry = { date: string, year: number|null, month: number|null, title: string, body: string, fields: {label:string,value:string}[]|null }`
  - 섹션형 엔트리는 `body`에 마크다운이 들어가고 `fields`는 `null`이다.

- [ ] **Step 1: vitest 설치**

```bash
cd frontend && npm install -D vitest
```

- [ ] **Step 2: package.json에 test 스크립트 추가**

`frontend/package.json`의 `"scripts"` 안, `"lint"` 줄 아래에 두 줄 추가:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

`vite.config.js`는 수정하지 않는다. vitest 기본 환경이 `node`라 순수 함수 테스트에 그대로 맞는다.

- [ ] **Step 3: 실패하는 테스트 작성**

`frontend/src/utils/docEntries.test.js` 생성:

```js
import { describe, it, expect } from "vitest";
import { parseSectionDoc } from "./docEntries";

// docs/work-log.md 발췌 — 중복 날짜(04-15 2회)와 제목 없는 섹션(04-04)을 함께 담았다.
const WORK_LOG_SAMPLE = `# 작업일지

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## 2026-04-04

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 프로젝트 초기 구조 생성 | 완료 |

---

## 2026-04-15

### 작업 요약

- 공유 드라이브 가이드 작성

---

## 2026-04-15 (추가 세션 — Office NPC OpenClaw LAN 이관 + 어드민 UI)

### 세부 내용

- LAN OpenClaw 를 Cloudflare Tunnel 로 공개
`;

describe("parseSectionDoc", () => {
  it("## 날짜 섹션마다 엔트리를 하나씩 만든다", () => {
    const entries = parseSectionDoc(WORK_LOG_SAMPLE);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.date)).toEqual(["2026-04-04", "2026-04-15", "2026-04-15"]);
  });

  it("날짜에서 year/month를 숫자로 뽑는다", () => {
    const [first] = parseSectionDoc(WORK_LOG_SAMPLE);
    expect(first.year).toBe(2026);
    expect(first.month).toBe(4);
  });

  it("괄호 안 문구를 제목으로 쓰고, 괄호가 없으면 빈 제목이다", () => {
    const entries = parseSectionDoc(WORK_LOG_SAMPLE);
    expect(entries[0].title).toBe("");
    expect(entries[2].title).toBe("추가 세션 — Office NPC OpenClaw LAN 이관 + 어드민 UI");
  });

  it("본문에서 헤딩 줄을 빼고 끝의 --- 구분선을 제거한다", () => {
    const entries = parseSectionDoc(WORK_LOG_SAMPLE);
    expect(entries[1].body).toBe("### 작업 요약\n\n- 공유 드라이브 가이드 작성");
    expect(entries[1].body).not.toContain("## 2026-04-15");
  });

  it("섹션형 엔트리의 fields는 null이다", () => {
    expect(parseSectionDoc(WORK_LOG_SAMPLE)[0].fields).toBeNull();
  });

  it("날짜 섹션이 없는 문서에는 빈 배열을 준다", () => {
    expect(parseSectionDoc("# 개발계획\n\n내용만 있고 날짜 섹션은 없다.")).toEqual([]);
  });
});
```

- [ ] **Step 4: 테스트를 돌려 실패를 확인**

Run: `cd frontend && npm test`
Expected: FAIL — `Failed to resolve import "./docEntries"`

- [ ] **Step 5: 파서 구현**

`frontend/src/utils/docEntries.js` 생성:

```js
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
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인**

Run: `cd frontend && npm test`
Expected: PASS — 6 tests

- [ ] **Step 7: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/utils/docEntries.js frontend/src/utils/docEntries.test.js
git commit -m "feat(docs): 작업일지 날짜 섹션 파서 + vitest 도입"
```

---

### Task 2: 표 파서

**Files:**
- Modify: `frontend/src/utils/docEntries.js`
- Test: `frontend/src/utils/docEntries.test.js`

**Interfaces:**
- Consumes: Task 1의 `DocEntry` 타입, `ISO_DATE` 상수
- Produces: `parseTableDoc(md: string) => DocEntry[]` — 표형 엔트리는 `body: ""`, `fields`에 `{label, value}` 배열이 들어간다. `날짜` 컬럼 다음 컬럼이 `title`, 나머지 컬럼이 `fields`.

실제 대상 문서의 표 헤더:
- `docs/bugfix-log.md` → `| 날짜 | 버그 설명 | 원인 | 수정 내용 | 관련 파일 |`
- `docs/upgrade-log.md` → `| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/utils/docEntries.test.js` 맨 위 import를 아래로 교체:

```js
import { parseSectionDoc, parseTableDoc } from "./docEntries";
```

파일 끝에 추가:

```js
// docs/bugfix-log.md 발췌
const BUGFIX_SAMPLE = `# 버그수정 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 버그 설명 | 원인 | 수정 내용 | 관련 파일 |
|------|----------|------|----------|----------|
| 2026-04-04 | 로그인 후 다시 로그인 화면 표시 | 401 인터셉터가 로그인 API 응답까지 토큰 삭제 | 인터셉터에서 auth 경로 제외 | frontend/src/services/api.js |
| 2026-04-05 | TVDesk NPC 대화 연결끊김 | DeskRPG 쿠키 Secure 플래그 | COOKIE_SECURE=false 설정 | 서버: ~/.deskrpg/start.sh |
`;

// docs/upgrade-log.md 발췌 — 날짜 다음 컬럼 이름이 다르다
const UPGRADE_SAMPLE = `# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|----------|----------|
| 2026-04-04 | 프로젝트 초기 구조 생성 | feat | backend/, frontend/ |
`;

describe("parseTableDoc", () => {
  it("표 데이터 행마다 엔트리를 하나씩 만든다", () => {
    const entries = parseTableDoc(BUGFIX_SAMPLE);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-04-04", "2026-04-05"]);
  });

  it("날짜 다음 컬럼을 제목으로 쓴다 — 컬럼 이름이 달라도 동작", () => {
    expect(parseTableDoc(BUGFIX_SAMPLE)[0].title).toBe("로그인 후 다시 로그인 화면 표시");
    expect(parseTableDoc(UPGRADE_SAMPLE)[0].title).toBe("프로젝트 초기 구조 생성");
  });

  it("나머지 컬럼을 라벨과 함께 fields에 담는다", () => {
    expect(parseTableDoc(BUGFIX_SAMPLE)[0].fields).toEqual([
      { label: "원인", value: "401 인터셉터가 로그인 API 응답까지 토큰 삭제" },
      { label: "수정 내용", value: "인터셉터에서 auth 경로 제외" },
      { label: "관련 파일", value: "frontend/src/services/api.js" },
    ]);
  });

  it("표형 엔트리의 body는 빈 문자열이다", () => {
    expect(parseTableDoc(BUGFIX_SAMPLE)[0].body).toBe("");
  });

  it("날짜가 ISO 형식이 아니면 원본을 보존하고 year/month만 null로 둔다", () => {
    const md = `| 날짜 | 변경 내용 |
|------|----------|
| 미상 | 언젠가 한 작업 |
`;
    const [entry] = parseTableDoc(md);
    expect(entry.date).toBe("미상");
    expect(entry.year).toBeNull();
    expect(entry.month).toBeNull();
    expect(entry.title).toBe("언젠가 한 작업");
  });

  it("표가 없거나 날짜 컬럼이 없으면 빈 배열을 준다", () => {
    expect(parseTableDoc("# 제목\n\n표 없음")).toEqual([]);
    expect(parseTableDoc("| 이름 | 값 |\n|---|---|\n| a | b |\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

Run: `cd frontend && npm test`
Expected: FAIL — `parseTableDoc is not a function`

- [ ] **Step 3: 구현 추가**

`frontend/src/utils/docEntries.js` 끝에 추가:

```js
/** `| a | b |` 형태 줄인가 */
function isTableRow(line) {
  return line.trim().startsWith("|");
}

/** `|---|---|` 형태 구분줄인가 */
function isSeparatorRow(line) {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes("-");
}

/** `| a | b |` → ["a", "b"] */
function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
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
        .filter((f) => f && f.value),
    });
  }

  return entries;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

Run: `cd frontend && npm test`
Expected: PASS — 12 tests

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/docEntries.js frontend/src/utils/docEntries.test.js
git commit -m "feat(docs): 버그수정/업그레이드 로그 표 파서"
```

---

### Task 3: 통합 파서 + 날짜 그룹핑 + 연/월 인덱스

**Files:**
- Modify: `frontend/src/utils/docEntries.js`
- Test: `frontend/src/utils/docEntries.test.js`

**Interfaces:**
- Consumes: Task 1의 `parseSectionDoc`, Task 2의 `parseTableDoc`
- Produces:
  - `parseDoc(md: string) => DocEntry[] | null` — 날짜 엔트리가 하나도 없으면 `null`
  - `groupByDate(entries: DocEntry[]) => DayGroup[]`
  - `DayGroup = { date: string, year: number|null, month: number|null, entries: DocEntry[] }` — 날짜 내림차순, 날짜 미상 그룹(`year === null`)은 맨 뒤
  - `buildIndex(groups: DayGroup[]) => YearIndex[]`
  - `YearIndex = { year: number, count: number, months: { month: number, count: number }[] }` — 연·월 모두 내림차순, `count`는 날 그룹 수

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/utils/docEntries.test.js` 맨 위 import를 아래로 교체:

```js
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseSectionDoc, parseTableDoc, parseDoc, groupByDate, buildIndex } from "./docEntries";
```

파일 끝에 추가:

```js
describe("parseDoc", () => {
  it("섹션형 문서를 알아본다", () => {
    expect(parseDoc(WORK_LOG_SAMPLE)).toHaveLength(3);
  });

  it("표형 문서를 알아본다", () => {
    expect(parseDoc(BUGFIX_SAMPLE)).toHaveLength(2);
  });

  it("날짜가 없는 문서에는 null을 준다 — 호출부가 기존 렌더로 fallback하도록", () => {
    expect(parseDoc("# 개발계획\n\n## 1단계\n\n내용")).toBeNull();
    expect(parseDoc("")).toBeNull();
    expect(parseDoc(null)).toBeNull();
  });
});

describe("groupByDate", () => {
  it("같은 날짜 엔트리를 한 그룹으로 묶는다", () => {
    const groups = groupByDate(parseSectionDoc(WORK_LOG_SAMPLE));
    expect(groups).toHaveLength(2);
    const apr15 = groups.find((g) => g.date === "2026-04-15");
    expect(apr15.entries).toHaveLength(2);
  });

  it("날짜 내림차순으로 정렬한다 — 원본 순서가 뒤집혀 있어도", () => {
    const md = `## 2026-04-08\n\n뒤에 온 날\n\n## 2026-04-07\n\n앞에 온 날\n`;
    const groups = groupByDate(parseSectionDoc(md));
    expect(groups.map((g) => g.date)).toEqual(["2026-04-08", "2026-04-07"]);
  });

  it("날짜 미상 엔트리는 버리지 않고 맨 뒤 그룹으로 모은다", () => {
    const md = `| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-04 | 있는 날짜 |
| 미상 | 없는 날짜 |
`;
    const groups = groupByDate(parseTableDoc(md));
    expect(groups).toHaveLength(2);
    expect(groups[1].year).toBeNull();
    expect(groups[1].entries[0].title).toBe("없는 날짜");
  });
});

describe("buildIndex", () => {
  it("연·월별 날 그룹 수를 내림차순으로 센다", () => {
    const md = `## 2026-05-03\n\na\n\n## 2026-04-15\n\nb\n\n## 2026-04-15\n\nc\n\n## 2026-04-04\n\nd\n`;
    const index = buildIndex(groupByDate(parseSectionDoc(md)));
    expect(index).toEqual([
      { year: 2026, count: 3, months: [{ month: 5, count: 1 }, { month: 4, count: 2 }] },
    ]);
  });

  it("날짜 미상 그룹은 인덱스에서 뺀다", () => {
    const groups = [{ date: "", year: null, month: null, entries: [{}] }];
    expect(buildIndex(groups)).toEqual([]);
  });
});

describe("실제 docs/work-log.md 불변식", () => {
  // 파일이 계속 자라므로 개수 대신 항상 참인 성질만 검증한다.
  const md = readFileSync(new URL("../../../docs/work-log.md", import.meta.url), "utf8");

  it("엔트리가 하나 이상 나오고 모든 날짜가 ISO 형식이다", () => {
    const entries = parseDoc(md);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("그룹이 날짜 내림차순이다", () => {
    const dates = groupByDate(parseDoc(md)).map((g) => g.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

Run: `cd frontend && npm test`
Expected: FAIL — `parseDoc is not a function`

- [ ] **Step 3: 구현 추가**

`frontend/src/utils/docEntries.js` 끝에 추가:

```js
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
    const key = entry.year === null ? " unknown" : entry.date;
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
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

Run: `cd frontend && npm test`
Expected: PASS — 22 tests

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/docEntries.js frontend/src/utils/docEntries.test.js
git commit -m "feat(docs): 문서 엔트리 통합 파서 + 날짜 그룹핑 + 연/월 인덱스"
```

---

### Task 4: 타임라인 화면

기본 화면을 만든다. 좌측 sticky 연/월 인덱스 + 우측 날짜 카드 목록. 이 태스크가 끝나면 세 로그 문서 모두 타임라인이 보이고, 날짜 없는 문서는 예전 그대로 보인다.

**Files:**
- Create: `frontend/src/components/docs/DocTimeline.jsx`
- Create: `frontend/src/components/docs/DocTimeline.module.css`
- Modify: `frontend/src/pages/admin/AdminDocs.jsx`
- Modify: `frontend/src/pages/admin/AdminDocs.module.css:5-7`

**Interfaces:**
- Consumes: Task 3의 `parseDoc`, `groupByDate`, `buildIndex`
- Produces: `<DocTimeline docKey={string} groups={DayGroup[]} />` — 카드 클릭 시 `/admin/docs/{docKey}/{date}`로 이동하는 `<Link>`. 표형(첫 엔트리의 `fields`가 배열)은 Task 6에서 인라인 확장으로 바뀐다.

- [ ] **Step 1: DocTimeline 컴포넌트 작성**

`frontend/src/components/docs/DocTimeline.jsx` 생성:

```jsx
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
```

- [ ] **Step 2: 스타일 작성**

`frontend/src/components/docs/DocTimeline.module.css` 생성:

```css
/* ═══════════════════════════════════════════════
   DocTimeline — Dark Glass Neon
   ═══════════════════════════════════════════════ */

.timeline {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: var(--sp-8, 2.5rem);
  align-items: start;
}

@media (max-width: 760px) {
  .timeline {
    grid-template-columns: 1fr;
    gap: var(--sp-5, 1.25rem);
  }
}

/* ── 좌측 연/월 인덱스 ── */

.index {
  position: sticky;
  top: var(--sp-6, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1, 0.25rem);
  font-family: var(--font-body, 'Inter'), sans-serif;
}

@media (max-width: 760px) {
  .index {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
}

.yearBlock {
  display: contents;
}

.yearBtn,
.monthBtn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2, 0.5rem);
  width: 100%;
  padding: var(--sp-2, 0.5rem) var(--sp-3, 0.75rem);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 5px);
  color: var(--text-tertiary, #888);
  cursor: pointer;
  transition: color var(--dur-fast, 120ms), background var(--dur-fast, 120ms);
}

@media (max-width: 760px) {
  .yearBtn,
  .monthBtn {
    width: auto;
  }
}

.yearBtn {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  color: var(--text-secondary, #ccc);
}

.monthBtn {
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  padding-left: var(--sp-5, 1.25rem);
}

.yearBtn:hover,
.monthBtn:hover {
  color: var(--neon-cyan, #00d4ff);
  background: rgba(255, 255, 255, 0.04);
}

.active {
  color: var(--neon-cyan, #00d4ff);
  background: rgba(0, 212, 255, 0.08);
  border-color: rgba(0, 212, 255, 0.25);
}

.count {
  font-size: var(--text-xs, 0.75rem);
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary, #888);
}

/* ── 우측 카드 목록 ── */

.stream {
  min-width: 0;
}

.monthHeading {
  font-family: var(--font-display, 'Noto Sans KR'), sans-serif;
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  letter-spacing: var(--tracking-wide, 0.08em);
  color: var(--text-tertiary, #888);
  margin: var(--sp-7, 2rem) 0 var(--sp-3, 0.75rem);
  padding-bottom: var(--sp-2, 0.5rem);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.stream > div:first-child .monthHeading {
  margin-top: 0;
}

.card {
  display: flex;
  align-items: baseline;
  gap: var(--sp-4, 1rem);
  padding: var(--sp-3, 0.75rem) var(--sp-4, 1rem);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-md, 10px);
  margin-bottom: var(--sp-2, 0.5rem);
  text-decoration: none;
  font-family: var(--font-body, 'Inter'), sans-serif;
  transition: border-color var(--dur-fast, 120ms), background var(--dur-fast, 120ms);
}

.card:hover {
  border-color: rgba(102, 126, 234, 0.45);
  background: rgba(255, 255, 255, 0.03);
}

.cardDate {
  flex-shrink: 0;
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--neon-indigo, #667eea);
}

.cardBody {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3, 0.75rem);
  min-width: 0;
}

.cardTitle {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #ccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card:hover .cardTitle {
  color: #ffffff;
}

.badge {
  flex-shrink: 0;
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(102, 126, 234, 0.15);
  color: var(--neon-indigo, #667eea);
}

.empty {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #888);
}
```

- [ ] **Step 3: AdminDocs가 타임라인을 쓰게 수정**

`frontend/src/pages/admin/AdminDocs.jsx` 전체를 아래로 교체:

```jsx
import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import { parseDoc, groupByDate } from "../../utils/docEntries";
import DocTimeline from "../../components/docs/DocTimeline";
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
  const { docKey } = useParams();
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
        {groups && <p className={styles.summary}>{summarize(groups)}</p>}
      </div>
      {loading ? (
        <div className={styles.skeleton} aria-label="로딩 중">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : groups ? (
        <DocTimeline docKey={docKey} groups={groups} />
      ) : (
        <div className={styles.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 페이지 최대폭 확대 + summary·스켈레톤 스타일**

`frontend/src/pages/admin/AdminDocs.module.css`의 5-7행

```css
.page {
  max-width: 820px;
}
```

을 아래로 교체:

```css
.page {
  max-width: 1000px;
}

.summary {
  font-family: var(--font-body, 'Inter'), sans-serif;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #888);
  margin: var(--sp-3, 0.75rem) 0 0;
}

/* ── 로딩 스켈레톤 ── */

.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2, 0.5rem);
}

.skeletonRow {
  height: 46px;
  border-radius: var(--radius-md, 10px);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.07) 37%,
    rgba(255, 255, 255, 0.03) 63%
  );
  background-size: 400% 100%;
  animation: skeletonShimmer 1.4s ease infinite;
}

@keyframes skeletonShimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeletonRow {
    animation: none;
  }
}
```

- [ ] **Step 5: 빌드와 린트 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 둘 다 에러 없이 종료

- [ ] **Step 6: 브라우저 수동 확인**

Run: `cd frontend && npm run dev`

`http://localhost:5173/admin/docs/work-log` 접속 후 확인:
- 좌측에 `2026` / `07월 1` / `06월 2` / `05월 5` / `04월 16` 인덱스가 보인다
- 우측에 월 헤더로 구분된 날짜 카드 24장이 최신순으로 보인다
- `2026-04-08` 카드가 `2026-04-07` 카드보다 **위**에 있다 (정렬 교정 확인)
- `05-01` 카드에 `3건` 배지가 붙어 있다
- `04월` 클릭 → 4월 카드만 남고, 다시 클릭 → 전체 복귀
- `2026` 클릭 → 전체 유지(2026만 있으므로), 버튼이 활성 표시된다

`/admin/docs/bugfix-log`, `/admin/docs/upgrade-log`도 타임라인으로 보이는지 확인.

`/admin/docs/dev-plan`, `/admin/docs/orbitron-server`는 **예전과 똑같이** 통짜 마크다운으로 보이는지 확인 (fallback 동작).

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/components/docs/ frontend/src/pages/admin/AdminDocs.jsx frontend/src/pages/admin/AdminDocs.module.css
git commit -m "feat(docs): 프로젝트 문서 타임라인 화면 + 연/월 인덱스"
```

---

### Task 5: 작업일지 날짜 상세

**Files:**
- Create: `frontend/src/components/docs/DocDayDetail.jsx`
- Create: `frontend/src/components/docs/DocDayDetail.module.css`
- Create: `frontend/src/styles/prose.module.css`
- Modify: `frontend/src/pages/admin/AdminDocs.jsx`
- Modify: `frontend/src/pages/admin/AdminDocs.module.css`
- Modify: `frontend/src/App.jsx:73`

**Interfaces:**
- Consumes: Task 3의 `DayGroup`, Task 4의 `AdminDocs` 구조
- Produces:
  - `<DocDayDetail docKey={string} groups={DayGroup[]} date={string} />` — `date`에 해당하는 그룹이 없으면 "해당 날짜의 기록이 없습니다." + 타임라인 복귀 링크를 보여준다.
  - `frontend/src/styles/prose.module.css`의 `.prose` 클래스 — 마크다운 본문 공용 스타일. `AdminDocs`의 fallback 렌더와 `DocDayDetail`의 본문이 함께 쓴다.

- [ ] **Step 1: 라우트를 옵셔널 파라미터로 확장**

`frontend/src/App.jsx` 73행

```jsx
            <Route path="/admin/docs/:docKey" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
```

을 아래로 **교체**한다 (줄 추가가 아니다):

```jsx
            <Route path="/admin/docs/:docKey/:date?" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
```

라우트를 하나 더 만들지 않고 옵셔널 파라미터(`:date?`, react-router 7.14 지원)를 쓰는 이유:
목록↔상세 이동이 **같은 라우트 안에서** 일어나므로 `AdminDocs`가 언마운트되지 않고, 이미
받아둔 136KB content를 다시 fetch하지 않는다. 라우트를 둘로 나누면 이동할 때마다 재요청과
로딩 깜빡임이 생긴다.

- [ ] **Step 2: 마크다운 본문 공용 스타일을 prose 모듈로 이동**

상세 화면도 마크다운 본문을 렌더하므로 소비자가 둘이 된다. 복사하지 말고 옮긴다.

`frontend/src/styles/prose.module.css` 생성 — 아래 규칙들은
`frontend/src/pages/admin/AdminDocs.module.css`의 109-221행(`/* ── Content / Prose ── */`
주석부터 파일 끝까지)에 있는 것을 **선택자 이름만 `.content` → `.prose`로 바꿔 그대로 옮긴
것**이다. 값은 하나도 바꾸지 않는다:

```css
/* ═══════════════════════════════════════════════
   Prose — 마크다운 본문 공용 스타일
   AdminDocs fallback 렌더와 DocDayDetail 본문이 함께 쓴다.
   ═══════════════════════════════════════════════ */

.prose {
  font-family: var(--font-body, 'Inter'), sans-serif;
  font-size: var(--text-base, 1rem);
  line-height: 1.8;
  color: var(--text-secondary, #ccc);
}

.prose h1,
.prose h2,
.prose h3 {
  font-family: var(--font-display, 'Noto Sans KR'), sans-serif;
  font-weight: 700;
  color: #ffffff;
  margin-top: var(--sp-8, 2.5rem);
}

.prose h1 {
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  padding-bottom: var(--sp-4, 1rem);
  border-bottom: 1px solid var(--border-default, rgba(255,255,255,0.1));
}

.prose h2 {
  font-size: var(--text-xl, 1.25rem);
}

.prose h3 {
  font-size: var(--text-lg, 1.125rem);
}

.prose code {
  font-size: 0.88em;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm, 5px);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--neon-cyan, #00d4ff);
}

.prose pre {
  background: rgba(0, 0, 0, 0.4);
  color: #e0e0e0;
  padding: var(--sp-5, 1.25rem);
  border-radius: var(--radius-md, 10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: var(--text-xs, 0.75rem);
  line-height: 1.7;
}

.prose pre code {
  background: none;
  padding: 0;
  color: inherit;
}

.prose a {
  color: var(--neon-indigo, #667eea);
  text-underline-offset: 3px;
}

.prose blockquote {
  margin: var(--sp-6, 1.75rem) 0;
  padding-left: var(--sp-5, 1.25rem);
  border-left: 3px solid var(--neon-indigo, #667eea);
  color: var(--text-secondary, #ccc);
  font-style: italic;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--sp-4, 1rem) 0;
  font-size: var(--text-sm, 0.875rem);
}

.prose th {
  text-align: left;
  font-weight: 700;
  color: #ffffff;
  padding: var(--sp-2, 0.5rem) var(--sp-3, 0.75rem);
  background: rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  white-space: nowrap;
}

.prose td {
  padding: var(--sp-2, 0.5rem) var(--sp-3, 0.75rem);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #ccc);
  vertical-align: top;
}

.prose tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.prose hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: var(--sp-8, 2.5rem) 0;
}

.prose ul, .prose ol {
  padding-left: var(--sp-6, 1.5rem);
}

.prose li {
  margin-bottom: var(--sp-1, 0.25rem);
}
```

그런 다음 `frontend/src/pages/admin/AdminDocs.module.css`에서 **`/* ── Content / Prose ── */`
주석부터 파일 끝까지를 통째로 삭제**한다. 남은 파일의 마지막 규칙은 Task 4에서 추가한
`@media (prefers-reduced-motion: reduce)` 블록이어야 한다.

- [ ] **Step 3: AdminDocs의 fallback 렌더를 prose로 교체**

`frontend/src/pages/admin/AdminDocs.jsx`에서 두 곳을 고친다.

(1) import에 한 줄 추가 — `styles` import 위:

```jsx
import prose from "../../styles/prose.module.css";
```

(2) fallback 렌더의 클래스를 바꾼다:

```jsx
        <div className={styles.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
```

을 아래로 교체:

```jsx
        <div className={prose.prose}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
```

- [ ] **Step 4: DocDayDetail 컴포넌트 작성**

`frontend/src/components/docs/DocDayDetail.jsx` 생성:

```jsx
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import prose from "../../styles/prose.module.css";
import styles from "./DocDayDetail.module.css";

export default function DocDayDetail({ docKey, groups, date }) {
  const idx = groups.findIndex((g) => g.date === date);

  if (idx === -1) {
    return (
      <div>
        <p className={styles.notFound}>해당 날짜의 기록이 없습니다.</p>
        <Link to={`/admin/docs/${docKey}`} className={styles.backLink}>← 목록으로</Link>
      </div>
    );
  }

  const group = groups[idx];
  // groups는 날짜 내림차순 — 앞쪽이 더 최신이다.
  const newer = idx > 0 ? groups[idx - 1] : null;
  const older = idx < groups.length - 1 ? groups[idx + 1] : null;

  return (
    <div>
      <nav className={styles.bar}>
        <span className={styles.crumbs}>
          <Link to={`/admin/docs/${docKey}`} className={styles.crumbLink}>목록</Link>
          <span className={styles.sep}>›</span>
          <span>{group.year}년 {group.month}월</span>
          <span className={styles.sep}>›</span>
          <span className={styles.current}>{group.date}</span>
        </span>
        <span className={styles.nav}>
          {older && (
            <Link to={`/admin/docs/${docKey}/${older.date}`} className={styles.navLink}>
              ← {older.date.slice(5)}
            </Link>
          )}
          {newer && (
            <Link to={`/admin/docs/${docKey}/${newer.date}`} className={styles.navLink}>
              {newer.date.slice(5)} →
            </Link>
          )}
        </span>
      </nav>

      {group.entries.map((entry, i) => (
        <article key={i} className={styles.entry}>
          <h2 className={styles.entryTitle}>
            {group.date}
            {entry.title && <span className={styles.entrySub}>{entry.title}</span>}
          </h2>
          <div className={prose.prose}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
          </div>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 스타일 작성**

`frontend/src/components/docs/DocDayDetail.module.css` 생성:

```css
/* ═══════════════════════════════════════════════
   DocDayDetail — Dark Glass Neon
   ═══════════════════════════════════════════════ */

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-3, 0.75rem);
  padding-bottom: var(--sp-4, 1rem);
  margin-bottom: var(--sp-6, 1.75rem);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  font-family: var(--font-body, 'Inter'), sans-serif;
  font-size: var(--text-xs, 0.75rem);
}

.crumbs {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2, 0.5rem);
  color: var(--text-tertiary, #888);
}

.crumbLink {
  color: var(--text-tertiary, #888);
  text-decoration: none;
  transition: color var(--dur-fast, 120ms);
}

.crumbLink:hover {
  color: var(--neon-cyan, #00d4ff);
}

.sep {
  color: var(--text-tertiary, #888);
  opacity: 0.5;
}

.current {
  color: var(--text-secondary, #ccc);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.nav {
  display: inline-flex;
  gap: var(--sp-2, 0.5rem);
}

.navLink {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-sm, 5px);
  color: var(--text-tertiary, #888);
  text-decoration: none;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: color var(--dur-fast, 120ms), border-color var(--dur-fast, 120ms);
}

.navLink:hover {
  color: var(--neon-cyan, #00d4ff);
  border-color: rgba(0, 212, 255, 0.35);
}

.entry + .entry {
  margin-top: var(--sp-8, 2.5rem);
  padding-top: var(--sp-6, 1.75rem);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.entryTitle {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-3, 0.75rem);
  font-family: var(--font-display, 'Noto Sans KR'), sans-serif;
  font-size: var(--text-xl, 1.25rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 var(--sp-4, 1rem);
}

.entrySub {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  color: var(--text-tertiary, #888);
}

/* 마크다운 본문 자체는 styles/prose.module.css의 .prose가 맡는다.
   여기에는 상세 화면 고유의 레이아웃만 둔다. */

.notFound {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #888);
  margin-bottom: var(--sp-4, 1rem);
}

.backLink {
  font-family: var(--font-body, 'Inter'), sans-serif;
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  color: var(--neon-indigo, #667eea);
  text-decoration: none;
}
```

- [ ] **Step 6: AdminDocs에 상세 분기 연결**

`frontend/src/pages/admin/AdminDocs.jsx`에서 네 곳을 고친다.

(1) import 한 줄 추가 — `DocTimeline` import 아래:

```jsx
import DocDayDetail from "../../components/docs/DocDayDetail";
```

(2) `useParams` 구조분해에 `date` 추가:

```jsx
  const { docKey, date } = useParams();
```

(3) 렌더 분기에서 `date`가 있으면 상세를 띄운다. 아래 부분

```jsx
      ) : groups ? (
        <DocTimeline docKey={docKey} groups={groups} />
      ) : (
```

을 아래로 교체:

```jsx
      ) : groups ? (
        date ? (
          <DocDayDetail docKey={docKey} groups={groups} date={date} />
        ) : (
          <DocTimeline docKey={docKey} groups={groups} />
        )
      ) : (
```

(4) 헤더의 summary는 목록에서만 보이게 한다. 아래 줄

```jsx
        {groups && <p className={styles.summary}>{summarize(groups)}</p>}
```

을 아래로 교체:

```jsx
        {groups && !date && <p className={styles.summary}>{summarize(groups)}</p>}
```

- [ ] **Step 7: 빌드와 린트 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 둘 다 에러 없이 종료

- [ ] **Step 8: 브라우저 수동 확인**

Run: `cd frontend && npm run dev`

- `/admin/docs/dev-plan`(날짜 없는 문서)이 **prose 이관 전과 똑같이** 보인다 — 코드블록·표·인용문 스타일이 그대로여야 한다
- `/admin/docs/work-log`에서 `04-29` 카드 클릭 → 그 날 본문이 렌더되고 URL이 `/admin/docs/work-log/2026-04-29`로 바뀐다
- 그 상태로 **새로고침(F5)** → 같은 화면이 유지된다 (딥링크 확인)
- 상단 breadcrumb에 `목록 › 2026년 4월 › 2026-04-29`
- `2026-04-29` 상세에서 `← 04-24`(더 과거) / `05-01 →`(더 최신) 버튼이 동작한다. 가장 최신 날짜(`07-29`)에서는 오른쪽 버튼이, 가장 오래된 날짜(`04-04`)에서는 왼쪽 버튼이 없다
- 카드를 클릭해 상세로 갈 때 **로딩 스켈레톤이 다시 뜨지 않는다** (옵셔널 파라미터 라우트라 재요청이 없어야 정상)
- `05-01` 상세 → 세션 3개가 구분선으로 나뉘어 이어서 보인다
- `/admin/docs/work-log/2026-01-01` 직접 입력 → "해당 날짜의 기록이 없습니다." + 목록 링크

- [ ] **Step 9: 커밋**

```bash
git add frontend/src/components/docs/ frontend/src/styles/prose.module.css frontend/src/pages/admin/AdminDocs.jsx frontend/src/pages/admin/AdminDocs.module.css frontend/src/App.jsx
git commit -m "feat(docs): 작업일지 날짜 상세 화면 + 딥링크 라우트 + 공용 prose 스타일"
```

---

### Task 6: 표형 문서 인라인 확장

버그수정·업그레이드 로그는 엔트리 본문이 표 한 행이라 페이지를 갈아끼울 분량이 아니다. 카드 클릭 시 그 자리에서 펼친다.

**Files:**
- Modify: `frontend/src/components/docs/DocTimeline.jsx`
- Modify: `frontend/src/components/docs/DocTimeline.module.css`

**Interfaces:**
- Consumes: Task 2가 만든 `entry.fields` (`{label, value}[]`), Task 4의 `DocTimeline`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: DocTimeline을 표형 분기하도록 수정**

`frontend/src/components/docs/DocTimeline.jsx`에서 세 곳을 고친다.

(1) `useState` import에 확장 상태를 추가 — 컴포넌트 본문 `const [filter, setFilter] = useState(null);` 아래에 한 줄:

```jsx
  const [openDate, setOpenDate] = useState(null);
```

(2) 표형 판별을 `visible` 계산 아래에 추가:

```jsx
  // 표형 문서(fields 보유)는 페이지 이동 없이 그 자리에서 펼친다.
  const isTableDoc = groups.some((g) => Array.isArray(g.entries[0].fields));
```

(3) 카드 렌더 부분 — `<Link to={...} className={styles.card}> … </Link>` 블록 전체를 아래로 교체:

```jsx
              {isTableDoc ? (
                <>
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
                      {group.entries.map((entry, i) => (
                        <dl key={i} className={styles.fields}>
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
                </>
              ) : (
                <Link to={`/admin/docs/${docKey}/${group.date}`} className={styles.card}>
                  <CardInner group={group} />
                </Link>
              )}
```

(4) 필터를 바꾸면 펼친 카드를 닫는다 — 두 `setFilter(...)` 호출 각각의 바로 뒤에 `setOpenDate(null);`를 추가한다. `onClick` 본문을 중괄호 블록으로 바꾸면 된다. 연 버튼:

```jsx
              onClick={() => {
                setFilter(filter?.year === year.year && !filter?.month ? null : { year: year.year });
                setOpenDate(null);
              }}
```

월 버튼:

```jsx
                onClick={() => {
                  setFilter(
                    filter?.year === year.year && filter?.month === m.month
                      ? null
                      : { year: year.year, month: m.month }
                  );
                  setOpenDate(null);
                }}
```

- [ ] **Step 2: 스타일 추가**

`frontend/src/components/docs/DocTimeline.module.css`의 `.card` 규칙을 아래로 교체 — `<button>`도 카드로 쓰이므로 버튼 기본 스타일을 지운다:

```css
.card {
  display: flex;
  align-items: baseline;
  gap: var(--sp-4, 1rem);
  width: 100%;
  padding: var(--sp-3, 0.75rem) var(--sp-4, 1rem);
  background: none;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-md, 10px);
  margin-bottom: var(--sp-2, 0.5rem);
  text-align: left;
  text-decoration: none;
  font-family: var(--font-body, 'Inter'), sans-serif;
  cursor: pointer;
  transition: border-color var(--dur-fast, 120ms), background var(--dur-fast, 120ms);
}
```

파일 끝에 확장 영역 스타일을 추가:

```css
/* ── 표형 인라인 확장 ── */

.detail {
  margin: 0 0 var(--sp-4, 1rem);
  padding: var(--sp-4, 1rem);
  border-left: 2px solid var(--neon-indigo, #667eea);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0 var(--radius-md, 10px) var(--radius-md, 10px) 0;
}

.fields {
  margin: 0;
}

.fields + .fields {
  margin-top: var(--sp-4, 1rem);
  padding-top: var(--sp-4, 1rem);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.fieldRow {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: var(--sp-3, 0.75rem);
  padding: var(--sp-1, 0.25rem) 0;
}

@media (max-width: 560px) {
  .fieldRow {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.fieldLabel {
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  color: var(--text-tertiary, #888);
  white-space: nowrap;
}

.fieldValue {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.7;
  color: var(--text-secondary, #ccc);
  word-break: break-word;
}
```

- [ ] **Step 3: 빌드와 린트 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 둘 다 에러 없이 종료

- [ ] **Step 4: 브라우저 수동 확인**

Run: `cd frontend && npm run dev`

- `/admin/docs/bugfix-log` → 카드 클릭 시 URL이 바뀌지 않고 그 자리에 `원인` / `수정 내용` / `관련 파일`이 펼쳐진다. 다시 클릭하면 접힌다
- 같은 날 버그가 여러 건인 날짜(`2026-04-06` 등)를 펼치면 건마다 `항목` 라벨과 함께 구분되어 보인다
- `/admin/docs/upgrade-log` → `카테고리` / `관련 파일`이 펼쳐진다
- 카드를 펼친 상태에서 좌측 월을 바꾸면 펼침이 닫힌다
- `/admin/docs/work-log`는 여전히 **페이지 이동** 방식이다 (인라인 확장이 아님)

- [ ] **Step 5: 전체 테스트 재확인**

Run: `cd frontend && npm test`
Expected: PASS — 22 tests

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/docs/
git commit -m "feat(docs): 버그수정/업그레이드 로그 카드 인라인 확장"
```

---

## 완료 조건

- [ ] `cd frontend && npm test` → 22 tests PASS
- [ ] `cd frontend && npm run lint && npm run build` → 에러 없음
- [ ] `/admin/docs/work-log` → 타임라인 24일, `04-08`이 `04-07`보다 위, `05-01`에 `3건` 배지
- [ ] `/admin/docs/work-log/2026-04-29` → 딥링크 새로고침 유지, 이전/다음 날 이동 동작
- [ ] `/admin/docs/bugfix-log`, `/admin/docs/upgrade-log` → 카드 인라인 확장 동작
- [ ] `/admin/docs/dev-plan`, `/admin/docs/orbitron-server` → 변경 전과 동일한 통짜 렌더
- [ ] `git status`에 `docs/*.md`(work-log·bugfix-log·upgrade-log) 신규 변경 없음 — 원본 무수정 확인
- [ ] `git diff --stat main...` 에 `backend/` 경로 없음 — 백엔드 무수정 확인
