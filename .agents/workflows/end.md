---
description: 작업 세션 종료 시 프로젝트 문서 자동 업데이트, 커밋, 요약 보고 - 세션 마무리 시 실행
---

# TwinverseAI 프로젝트 - 작업 세션 종료

작업을 마무리할 때 아래 단계를 순서대로 수행합니다.
**프로젝트 문서(docs/) 자동 업데이트가 핵심입니다.**

## 1단계: 세션 작업 내역 수집

// turbo
```bash
cd c:\WORK\TwinverseAI && git status --short
```

// turbo
```bash
cd c:\WORK\TwinverseAI && git log --since="midnight" --format="%h %ai %s" --reverse
```

→ 커밋 메시지와 변경 파일을 분석하여 카테고리로 분류:
- **feat** → `upgrade-log.md`
- **fix** → `bugfix-log.md`
- **style/refactor/docs/infra** → `work-log.md`
- 마일스톤 변화 → `dev-plan.md`

## 2단계: docs/ 문서 자동 업데이트

기존 내용을 읽은 뒤 아래에 추가(append). 이전 기록은 절대 삭제하지 않습니다.

- **work-log.md**: 매번 반드시 업데이트 (오늘 날짜 섹션 추가)
- **bugfix-log.md**: fix 커밋이 있을 때만 테이블 행 추가
- **upgrade-log.md**: feat 커밋이 있을 때만 테이블 행 추가
- **dev-plan.md**: 마일스톤/기능 상태 변화 시 상태 컬럼 업데이트

## 3단계: Git 커밋 & 푸시

// turbo
```bash
cd c:\WORK\TwinverseAI && git add -A
```

```bash
cd c:\WORK\TwinverseAI && git commit -m "커밋메시지"
```

// turbo
```bash
cd c:\WORK\TwinverseAI && git push origin main
```

## 4단계: 세션 종료 보고

사용자에게 작업 요약, 문서 업데이트 현황, Git 상태, 다음 세션 참고사항을 보고합니다.
