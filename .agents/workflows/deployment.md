---
description: TwinverseAI 배포 프로세스
---

# TwinverseAI 배포 아키텍처

## 배포 플랫폼: Orbitron

- 설정 파일: `Orbitron.yaml` (프로젝트 루트)
- DB: Orbitron PostgreSQL 서버 (`192.168.219.101:5432`)

## 배포 흐름

1. 개발자가 코드 수정 → `git commit` → `git push` (Windows에서)
2. Orbitron 서버에서 자동 빌드 및 배포 진행

## 서비스 구성

| 서비스 | 타입 | 포트 | 설명 |
|--------|------|------|------|
| backend | web | 8000 | FastAPI API 서버 |
| frontend | static | - | React 빌드 결과물 (dist/) |

## 로컬 개발 환경

| 서비스 | 포트 | 실행 명령 |
|--------|------|----------|
| Backend | 8000 | `cd backend && uvicorn main:app --reload` |
| Frontend | 5173 | `cd frontend && npm run dev` |

## 환경 변수

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `SECRET_KEY`: JWT 서명 키
- `FRONTEND_URL`: 프론트엔드 도메인 (CORS)
- `VITE_API_URL`: 백엔드 API URL (프론트엔드)

## 주의사항

- 코드 수정 후 커밋/푸시만 하면 배포는 Orbitron에서 별도 진행
- `.env` 파일은 커밋하지 않음 (Orbitron에서 환경변수 직접 설정)
