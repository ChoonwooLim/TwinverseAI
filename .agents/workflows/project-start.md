---
description: 원스톱 프로젝트 부트스트랩 - "project start" 입력 시 환경점검 → /init → MCP → 의존성 → /end 자동 실행
---

# TwinverseAI 원스톱 프로젝트 부트스트랩

사용자가 "project start" 입력 시 전체 파이프라인을 자동 실행합니다.
상세 내용은 `.claude/skills/project-start/SKILL.md` 참조.

## 파이프라인 요약

1. **환경 점검** — git, gh, node, python 확인
2. **/init** — 프로젝트 구조 + 코드 + GitHub 리포지토리 생성
3. **MCP 설정** — 10개 MCP 서버 자동 구성
4. **Backend 설치** — Python venv + pip install
5. **Frontend 설치** — npm install
6. **/end** — 문서 업데이트 + 커밋 + 푸시
7. **최종 보고**
