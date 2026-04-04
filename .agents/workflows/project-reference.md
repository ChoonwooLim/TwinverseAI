---
description: TwinverseAI 프로젝트 아키텍처 및 핵심 참고사항
---

# TwinverseAI 프로젝트 구조

## 디렉토리 구조

```
c:\WORK\TwinverseAI\
├── .agents/workflows/     # AI 작업 워크플로우
├── .claude/skills/        # Claude Code 스킬
├── backend/               # FastAPI 백엔드
│   ├── routers/           # API 라우터 (auth, admin, docs, skills, plugins)
│   ├── models/            # SQLModel 모델 (User)
│   ├── services/          # 비즈니스 로직 (auth_service)
│   ├── main.py            # FastAPI 앱 엔트리
│   ├── database.py        # DB 엔진/세션
│   ├── deps.py            # 인증 의존성
│   └── seed_admin.py      # SuperAdmin 시드
├── frontend/              # React + Vite 웹 앱
│   └── src/
│       ├── components/    # ProtectedRoute
│       ├── pages/         # Home, Login, Dashboard, DocViewer, Skills, Plugins
│       └── services/      # axios API 인스턴스
├── docs/                  # 프로젝트 문서 (마크다운)
├── CLAUDE.md              # Claude Code 프로젝트 가이드
└── Orbitron.yaml          # Orbitron 배포 설정
```

## 기술 스택

- **Backend**: FastAPI + SQLModel + PostgreSQL
- **Frontend**: React + Vite + axios + react-markdown
- **인증**: JWT (passlib + python-jose)
- **배포**: Orbitron

## 핵심 기억사항

### 배포

- **반드시 /deployment 워크플로우 참조**
- Windows에서는 커밋/푸시만 수행

### 작업 시작 시

- **반드시 /start 워크플로우 실행**
