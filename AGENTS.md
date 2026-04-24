# TwinverseAI

## AI 리소스 공유 규칙 (모든 프로젝트 공통)

> **반드시 `C:\WORK\infra-docs\ai-shared-registry.md`를 단일 진실 원천(SSOT)으로 참조할 것.**

- 오픈소스 AI(Ollama/Flux/Whisper 등)와 유료 API 키(OpenAI·Anthropic·Replicate·R2 등)는
  Steven의 모든 프로젝트(TwinverseAI · SodamFN · 이후 추가)가 **공동 사용**한다.
- AI 컴퓨트 전용 서버: **`twinverse-ai` (192.168.219.117)** — Threadripper 3970X + RTX 3090 24GB + Ollama.
- AI 관련 `.env` / `Orbitron.yaml` / docs 변경 시 반드시 **레지스트리 먼저 업데이트 → 그다음 코드 반영**.
- 변수명은 레지스트리 섹션 5 네이밍 컨벤션을 그대로 사용 (`AI_GPU_SERVER_URL`, `OLLAMA_URL`, `{PROVIDER}_API_KEY` 등).
- 포트 할당은 레지스트리 섹션 2 포트 예약표를 먼저 확인. 충돌 방지.
- API 키 실제 값은 레지스트리에 기입 금지 — **Orbitron secrets만** 사용.
- 새 AI 키/모델/서비스 추가 시 양쪽(또는 모든) 프로젝트를 **동시에 동기화**. 한쪽만 업데이트 금지.

---

## 프로젝트 비전 (최상위 방침)

> **반드시 `docs/vision.md`를 읽고 모든 작업에 적용할 것.**

- **최종 목표**: 미래 인간과 AI가 공존하는 세계 최고의 생태계 (Twinverse Platform)
- **핵심 제품**: TwinverseDesk — UE5 Pixel Streaming 기반 가상 데스크탑 + AI 1인 기업 시스템
- **품질 기준**: "세계 어떤 사이트/플랫폼보다 뛰어난가?" — 타협 없는 최고 수준
- **기술 원칙**: 최신 최고 기술 즉시 채택, 항상 최전선 유지
- **AI 역할**: 단순 도구가 아닌 세계 최고 전문가 파트너로서 작업

## 프로젝트 구조
- `backend/` — FastAPI 백엔드 (Python, PostgreSQL on Orbitron)
- `frontend/` — 웹 앱 (React + Vite, port 5173)
- `docs/` — 프로젝트 문서 (마크다운, /end 스킬로 자동 업데이트)

## 랜딩페이지 메뉴
- 프로젝트 문서 (4개): 개발계획서, 버그수정 로그, 업그레이드 로그, 작업일지
- AI 스킬 뷰어: /skills — .Codex/skills/ 디렉토리의 모든 스킬을 상세 설명과 함께 조회
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
- **반드시 .dockerignore로 .env 차단** (로컬 DB URL이 Docker에 침투하면 연결 실패)
- Dockerfile에 ENV로 기본 환경변수 설정 (Internal DB URL, SECRET_KEY 등)

## .env 규칙
- .env는 로컬 개발 전용 (.gitignore + .dockerignore에 포함)
- 형식: `KEY=value` (접두어/설명 금지, `Internal DATABASE_URL=...` ← 파싱 실패)
- **ASCII 전용 (주석 포함)** — 한글/이모지/비-ASCII 절대 금지.
  - 이유: 2026-04-10 인시던트 (bugfix-log.md) — .env의 한글 주석 한 줄 때문에
    한국어 Windows가 cp949로 파일을 읽다가 UnicodeDecodeError, uvicorn이 조용히 죽고
    Cloudflare 터널이 502 반환 → 브라우저는 이걸 CORS 오류로 표시. 추적에 시간 다수 소요.
  - 방어 3중: (1) `load_dotenv(encoding="utf-8")` 명시 (2) `start_gpu_server.bat`가
    `PYTHONUTF8=1` 설정 (3) `scripts/check_backend_ready.py` 사전검증으로 non-ASCII 차단.
  - 의심스러우면 `python scripts/check_backend_ready.py` 를 먼저 돌려볼 것.
- Docker 배포는 Dockerfile ENV 또는 Orbitron 대시보드 사용
- 비환경변수 메모(SSH 정보, 토큰 등)는 .env에 넣지 말 것

## GPU 서버 기동 규칙

- GPU PC(PS2 호스팅)는 반드시 `scripts/start_gpu_server.bat`로 기동 — 직접 `uvicorn`
  실행 금지. 스크립트가 pre-flight 검사 + PYTHONUTF8=1 + post-launch 헬스폴링까지 수행.
- pre-flight 실패 시 스크립트는 uvicorn을 띄우지 않고 중단. 이 동작을 우회하지 말 것.
- 백엔드 크래시는 브라우저에서 CORS 오류로 보이므로, "CORS 오류"가 뜨면 먼저
  `curl http://localhost:8000/health` 로 서버가 살았는지 확인할 것.

## 커밋 메시지 규칙
- `feat:` 새 기능 / `fix:` 버그 수정 / `style:` UI / `refactor:` 리팩토링 / `docs:` 문서 / `infra:` 인프라
