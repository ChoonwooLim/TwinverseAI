import { describe, it, expect } from "vitest";
import { parseSectionDoc, parseTableDoc } from "./docEntries";

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

  it("괄호가 닫히지 않아도 섹션 경계로 인식하고 본문을 손실 없이 보존한다", () => {
    const md = `## 2026-04-04 (unterminated

### 세부 내용

- 괄호가 닫히지 않아도 다음 섹션 전까지 손실 없이 보존되어야 한다
`;
    const entries = parseSectionDoc(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe("2026-04-04");
    expect(entries[0].body).toBe(
      "### 세부 내용\n\n- 괄호가 닫히지 않아도 다음 섹션 전까지 손실 없이 보존되어야 한다"
    );
  });
});

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
