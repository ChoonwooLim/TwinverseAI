---
name: start
description: 새 작업 세션 시작 - 프로젝트 컨텍스트 자동 로드
user-invocable: true
---

# TwinverseAI 프로젝트 - 작업 세션 시작

새로운 작업을 시작하기 전에 아래 단계를 반드시 수행하여 프로젝트의 현재 상태를 정확히 파악합니다.

## 1단계: 프로젝트 현재 상태 확인
// turbo
```
cd c:\WORK\TwinverseAI && git log --since="midnight" --format="%h %ai %s" --reverse
```
→ 오늘 세션에서 수행한 커밋들을 시간순으로 확인합니다.

## 2단계: 사용자에게 보고

위 정보를 요약하여 사용자에게 간단히 보고합니다:
- 프로젝트 구조 확인 완료 여부
- 최근 작업 이력 요약 (당일)
- 준비 완료 상태 알림

그 후 사용자의 작업 요청을 수행합니다.
