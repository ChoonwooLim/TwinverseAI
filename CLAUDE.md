# TwinverseAI

## 프로젝트 구조
- `backend/` — FastAPI 백엔드 (Python, PostgreSQL on Orbitron)
- `frontend/` — 웹 앱 (React + Vite, port 5173)
- `docs/` — 프로젝트 문서 (마크다운, /end 스킬로 자동 업데이트)

## 랜딩페이지 메뉴
- 프로젝트 문서 (4개): 개발계획서, 버그수정 로그, 업그레이드 로그, 작업일지
- AI 스킬 뷰어: /skills — .claude/skills/ 디렉토리의 모든 스킬을 상세 설명과 함께 조회
- 플러그인 관리: /plugins — 설치된 MCP 플러그인 조회, 환경변수 수정, 새 플러그인 추가/삭제

## 로컬 개발
- Backend: `cd backend && uvicorn main:app --reload` (port 8000)
- Frontend: `cd frontend && npm run dev` (port 5173)

## 인증
- JWT 기반 (Bearer Token)
- 역할: user / admin / superadmin
- 어드민 대시보드: `/admin` (admin 이상 접근)

## Git 규칙
- 기본 브랜치는 반드시 `main` 사용 (master 금지 — Orbitron이 main을 기본으로 clone)
- `git init` 후 `git branch -m master main` 또는 `git init -b main` 사용

## 배포
- Orbitron 배포 서버 사용 (Linux)
- DB: Orbitron PostgreSQL 서버
- Windows에서는 커밋/푸시만 수행, 배포는 Orbitron에서 진행
- **반드시 프로젝트 루트에 Dockerfile 포함** (Orbitron 자동 생성 Dockerfile은 깨지므로 절대 의존 금지)
- Dockerfile은 멀티스테이지 빌드: Node(프론트엔드 빌드) → Python(백엔드 + 정적파일 서빙)

## 커밋 메시지 규칙
- `feat:` 새 기능 / `fix:` 버그 수정 / `style:` UI / `refactor:` 리팩토링 / `docs:` 문서 / `infra:` 인프라
