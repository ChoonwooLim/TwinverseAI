# 작업일지

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## 2026-04-04

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 프로젝트 초기 구조 생성 | 완료 |
| feat | 프로덕션급 UI 디자인 적용 (frontend-design) | 완료 |
| infra | GitHub 리포지토리 생성 + gh CLI 설정 | 완료 |
| infra | Git 기본 브랜치 main으로 변경 | 완료 |
| docs | CLAUDE.md Git 규칙 추가 | 완료 |
| infra | Dockerfile 추가 + 프론트엔드 정적파일 서빙 | 완료 |
| infra | Dockerfile 필수 규칙 CLAUDE.md + /init 스킬에 반영 | 완료 |

### 세부 내용

- 프로젝트 초기 세팅 완료 (FastAPI + React + Vite)
- 인증 시스템 (JWT) 구현
- 어드민 대시보드 기본 구조 생성
- 프로젝트 문서 시스템 구성
- 스킬 뷰어 + 플러그인 관리 페이지 생성
- /frontend-design 스킬로 프로덕션급 UI 디자인 적용 (6개 페이지 + CSS 디자인 시스템)
- GitHub 리포지토리 생성 및 푸시 (ChoonwooLim/TwinverseAI, public)
- gh CLI 설치 및 인증 설정
- Git 기본 브랜치 master → main 변경 (Orbitron 배포 호환)
- CLAUDE.md에 Git 규칙 추가 (기본 브랜치 main 필수)
- /init 스킬에 `git init -b main` 반영
- 멀티스테이지 Dockerfile 추가 (Orbitron 자동 생성 Dockerfile 파싱 오류 해결)
- backend/main.py에 SPA 정적파일 서빙 코드 추가
- CLAUDE.md + /init 스킬에 Dockerfile 필수 생성 규칙 반영

---

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 로그인 회원가입 탭 + 자동 admin 생성 + bcrypt | 완료 |
| feat | 게시판 시스템 (Post, Comment, FileRecord 모델 + CRUD API) | 완료 |
| feat | 레이아웃 컴포넌트 (TopBar, Sidebar, Footer, MainLayout) | 완료 |
| feat | 게시판 컴포넌트 (PostList, PostDetail, PostForm, CommentSection, FileUpload) | 완료 |
| feat | 공개 페이지 (HomePage, AboutPage, ServicesPage) | 완료 |
| feat | 커뮤니티 페이지 (BoardPage, PostPage) | 완료 |
| feat | 어드민 페이지 (Dashboard, Users, Boards, Docs, Skills, Plugins) | 완료 |
| feat | App.jsx 포탈 레이아웃 + 라우팅 전면 재구성 | 완료 |
| fix | 로그인 후 다시 로그인 화면 표시되는 버그 수정 | 완료 |
| fix | JWT sub 클레임 문자열 변환 (python-jose 호환) | 완료 |
| style | Architectural Futurism 디자인 적용 (board, pages, design system) | 완료 |
| style | Dark Glass Neon 디자인으로 전면 변경 (twinverse.org 스타일 매칭) | 완료 |
| docs | /init 스킬 전면 업데이트 (현재 포탈 전체 코드 반영) | 완료 |

### 세부 내용 (세션 2)

- 로그인 페이지에 회원가입 탭 추가, bcrypt 직접 사용
- 앱 시작 시 자동 admin 계정 생성 (admin/admin1234)
- Post, Comment, FileRecord 모델 + boards, comments, files 라우터 구현
- 어드민 라우터 확장 (통계, 사용자 관리, 게시판 관리)
- TopBar (glassmorphism), Sidebar, Footer, MainLayout 레이아웃 구현
- 게시판 컴포넌트 5종 + 커뮤니티 페이지 2종 + 공개 페이지 3종 + 어드민 페이지 6종 구현
- JWT sub 클레임을 문자열로 변환하여 python-jose 호환 버그 수정
- 로그인 후 redirect loop 버그 수정 (401 인터셉터 로직 개선)
- **디자인 전면 변경**: Architectural Futurism → Dark Glass Neon (twinverse.org 스타일)
  - 22개 CSS 파일 전면 재작성
  - 폰트: Syne + Plus Jakarta Sans → Noto Sans KR + Inter
  - 컬러: 크림/울트라마린 → 다크 배경(#0a0e27) + 네온 액센트(#667eea, #00d4ff)
  - 글래스모피즘: backdrop-filter blur, rgba 반투명 표면
  - 카드: 15px border-radius, glow shadow hover
  - 그라디언트 버튼: #667eea → #764ba2

---

### 작업 요약 (세션 3)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | TwinverseDesk 메뉴 + 3개 서브페이지 구현 | 완료 |

### 세부 내용 (세션 3)

- TopBar에 TwinverseDesk 드롭다운 메뉴 추가 (3개 서브메뉴)
- DeskRPG 분석 보고서 페이지 작성 (기술 스택, 규모, 핵심 기능, DB 구조, 한계점 분석)
- TwinverseDesk 개발계획 페이지 작성 (비전, DeskRPG 비교표, 시스템 아키텍처, UE5 핵심 기술, 5단계 로드맵)
- TwinverseDesk 실행하기 페이지 작성 (히어로, 기능 프리뷰, 시스템 요구사항, 개발 진행 현황)
- 3개 페이지 모두 Dark Glass Neon 디자인 시스템 적용
- App.jsx에 TwinverseDesk 라우트 추가

---

## 2026-04-05

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | TVDesk Socket.IO 실시간 연결 실패 — 쿠키 Secure 플래그 문제 해결 | 완료 |
| fix | TVDesk 리눅스 브라우저 소켓 인증 실패 — 프록시 토큰 자동 주입 | 완료 |
| infra | TVDesk 서버 프록시 업그레이드 (twinverse_token → DeskRPG token 변환) | 완료 |
| infra | TVDesk start.sh 영구 설정 (COOKIE_SECURE=false, JWT_SECRET 등) | 완료 |

### 세부 내용

- TVDesk NPC 호출/대화 기능 "연결끊김" 디버깅 및 해결
  - 원인 1: DeskRPG 쿠키에 `Secure` 플래그 → Cloudflare Tunnel 내부 HTTP에서 브라우저가 쿠키 저장 거부
  - 해결: `COOKIE_SECURE=false` 환경변수로 Secure 플래그 제거
- 리눅스 브라우저 소켓 인증 실패 디버깅 및 해결
  - 원인 2: 리눅스 브라우저에 DeskRPG `token` 쿠키가 설정되지 않고 `twinverse_token`만 존재
  - 해결: 프록시(proxy.js)에서 `twinverse_token`을 감지하여 DeskRPG 호환 JWT를 자동 생성/주입
- 프록시(~/.deskrpg/proxy.js) 업그레이드 — jose 라이브러리로 JWT 재서명, 유저 매핑 테이블 내장
- start.sh 영구 설정 파일 생성 (COOKIE_SECURE, JWT_SECRET, INTERNAL_HOSTNAME 포함)
- 멀티유저 동작 확인 (Windows + Linux 동시 접속, 캐릭터 표시, 채널 채팅 동작)

---

## 2026-04-06

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | TwinverseDesk 개발계획 전면 업그레이드 (KPI, Phase 확장, UE5 기술 추가) | 완료 |
| style | TVDesk 실행하기 → TwinverseDesk 실행하기 메뉴명 변경 | 완료 |
| fix | Cloudflare Tunnel 충돌 해결 (중복 프로세스 정리) | 완료 |

### 세부 내용

- TwinverseDesk 개발계획 페이지 전면 업그레이드
  - KPI 성능 목표 섹션 신규 추가 (동시접속 200+, 60 FPS, 지연 <50ms 등 6개 지표)
  - Phase 1 상태를 "진행 중"으로 변경 (펄스 애니메이션 추가)
  - 5개 Phase 내용 대폭 확장 (OAuth SSO, AI 코드 리뷰어 NPC, 마켓플레이스 등)
  - 비교표 15개 항목 (기존 12개 → 인증/업무관리/지식베이스 추가)
  - 아키텍처 7개 레이어 (기존 6개 → 인프라 레이어 추가)
  - UE5 핵심 기술 8개 (기존 6개 → Mass Entity ECS, Niagara VFX 추가)
- 메뉴명 "TVDesk 개발계획" → "TwinverseDesk 개발계획", "TVDesk 실행하기" → "TwinverseDesk 실행하기" 변경
- TVDesk 외부 접속 불가 — Cloudflare Tunnel 중복 프로세스 정리로 해결

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 어드민 사이드바 프로젝트 문서 서브메뉴 구현 | 완료 |
| feat | AdminDocs 마크다운 뷰어 리팩토링 (remark-gfm, DOC_TITLES) | 완료 |
| docs | /init 스킬 업데이트 (Sidebar groups 패턴, AdminDocs 템플릿, remark-gfm 의존성) | 완료 |

### 세부 내용 (세션 2)

- Sidebar.jsx에 `groups` 패턴 추가 — admin 섹션에 "프로젝트 문서" 서브메뉴 그룹 (개발계획, 버그수정 로그, 업그레이드 로그, 작업일지)
- AdminDocs.jsx 전면 리팩토링 — 리스트 뷰 제거, 사이드바 기반 docKey 라우팅, ReactMarkdown + remark-gfm으로 GFM 테이블 렌더링
- AdminDocs.module.css에 마크다운 prose 스타일 추가 (table, blockquote, hr, code, pre 등)
- remark-gfm 패키지 의존성 추가 (package.json)
- /init 스킬(SKILL.md)에 Sidebar groups 패턴, AdminDocs 컴포넌트 템플릿, remark-gfm 의존성 반영

### 작업 요약 (세션 3)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | AI 스킬/플러그인 페이지에 실제 상세 내용 추가 (25개 스킬, 14개 플러그인) | 완료 |
| feat | 프로젝트 문서를 PostgreSQL 기반으로 전환 (filesystem → DB) | 완료 |
| feat | /init 스킬 전면 업그레이드 — 현재 사이트와 동일한 프로젝트 자동 생성 | 완료 |
| feat | 스킬/플러그인 목록 JSON 분리 + /end 자동 동기화 로직 추가 | 완료 |
| feat | 게시판별 샘플 게시글 5개씩 자동 생성 (총 20개) | 완료 |
| feat | /code-review 스킬 신규 생성 (5차원 점검, 등급별 리포트) | 완료 |
| fix | Docker 환경 docs/ 경로 불일치 수정 (404 해결) | 완료 |
| fix | docs 경로 자동 탐색 (환경변수 → Docker → 로컬 순서) | 완료 |
| style | 프로젝트 문서/Claude Code 메인메뉴 + 서브메뉴 구조 변경 | 완료 |
| refactor | Cascade Delete 적용 + Response Model 추가 (코드 리뷰 반영) | 완료 |
| refactor | 프론트엔드 성능 최적화 (코드 스플리팅, 폰트 최적화, Vite 청크 분리) | 완료 |

### 세부 내용 (세션 3)

- AI 스킬 페이지: 25개 스킬을 3카테고리(프로젝트 관리, 디자인&UX, 코드 품질)로 정리, 클릭 시 주요기능/사용법 펼침
- AI 플러그인 페이지: 14개 플러그인을 2카테고리(공식 플러그인, MCP 서버)로 정리, 카드 UI
- 프로젝트 문서 PostgreSQL 전환: Document 모델 추가, _seed_docs() 시작 시 docs/ → DB 동기화
- Docker docs 404 수정: Path 해석 문제 → DOCS_DIR 환경변수 + 자동 탐색 로직
- 사이드바 children 패턴: groups → children 방식으로 리팩토링 (프로젝트 문서, Claude Code 서브메뉴)
- /init 스킬: {{PROJECT_NAME}} 변수, Document 모델, DB 기반 docs, children 사이드바 패턴 반영
- /end 스킬: 2.5단계 스킬/플러그인 자동 동기화 로직 추가
- 샘플 게시글: _seed_sample_posts()로 공지/QnA/갤러리/비디오 각 5개 (AI/메타버스 테마)
- Cascade Delete: Post 모델에 Relationship cascade 설정, boards.py에서 N+1 삭제 루프 제거
- 성능 최적화: React.lazy() 16개 페이지 코드 스플리팅, 중복 폰트 import 제거, 폰트 웨이트 10→7개 축소, Suspense를 MainLayout 내부 Outlet으로 이동, Vite manualChunks(vendor/markdown 분리)
- /code-review 스킬: 보안/성능/코드품질/베스트프랙티스/유지보수성 5차원 점검, P0-P3 등급 리포트

### 작업 요약 (세션 4)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 이미지 갤러리 전면 업그레이드 (썸네일 카드, 라이트박스 뷰어, 샘플 이미지 생성) | 완료 |

### 세부 내용 (세션 4)

- Pillow로 5개 샘플 갤러리 이미지 생성 (Dark Glass Neon 테마 - 포탈, 대시보드, 개발계획, 디자인시스템, 스킬목록)
- 백엔드 갤러리 목록 API에 thumbnail 필드 추가 (첫 번째 이미지 경로, FileRecord JOIN)
- _seed_gallery_images() 함수로 갤러리 게시글에 이미지 FileRecord 자동 연결
- PostList 갤러리 그리드 업그레이드: 썸네일 이미지 카드 + 호버 줌 효과 + SVG placeholder
- PostDetail 갤러리 뷰어: 이미지 그리드 + 클릭 시 라이트박스 (이전/다음 네비게이션, 파일명 캡션, 키보드 접근성)
- 이미지와 일반 첨부파일 분리 표시

### 작업 요약 (세션 5)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 갤러리 이미지 배포 404 — Docker VOLUME이 uploads 덮어씀 | 완료 |
| fix | 갤러리 이미지 로컬 깨짐 — Vite 프록시 미설정 | 완료 |
| fix | UPLOAD_DIR 빈 문자열 → Path("") = CWD(.) 해석 문제 | 완료 |
| fix | StaticFiles mount → Docker VOLUME 충돌 | 완료 |
| fix | 갤러리 샘플 이미지 Git 미추적 → Docker 빌드 실패 (502) | 완료 |
| infra | Orbitron.yaml 환경변수/헬스체크/배포 체크리스트 업그레이드 | 완료 |
| infra | .dockerignore .env 차단 + Dockerfile ENV 기본값 추가 | 완료 |
| docs | /init 스킬 전면 업그레이드 — 이미지/업로드 배포 버그 재발 방지 (12개 섹션) | 완료 |

### 세부 내용 (세션 5)

- 배포 사이트 갤러리 이미지 404 근본 원인 추적 및 해결 (5단계 디버깅):
  1. Docker VOLUME `/app/uploads`가 Orbitron 빈 볼륨으로 마운트 → COPY한 이미지 덮어씀
  2. `.gitignore`에 `uploads/` → Git에 이미지 없음 → Docker 빌드 실패 (502)
  3. `UPLOAD_DIR=""` (Orbitron override) → `Path("")` = CWD(.) → 소스 폴더를 uploads로 착각
  4. `StaticFiles` mount → Docker VOLUME과 충돌하여 파일 미검색
  5. Vite 프록시 미설정 → `<img src="/uploads/...">` 요청이 SPA HTML 반환
- 해결책: 갤러리 이미지를 `backend/gallery_defaults/`에 포함, 시작 시 uploads로 복사
- `/uploads` 서빙을 StaticFiles mount → 명시적 `@app.get("/uploads/{filename}")` 라우트로 변경
- `/health` 엔드포인트에 `uploads_dir`, `uploads_files` 디버그 정보 추가
- `vite.config.js`에 `/api`, `/uploads`, `/health` 프록시 추가
- `api.js` baseURL을 `""` (same-origin)으로 통일
- `/init` 스킬에 위 모든 수정사항 반영 (12개 섹션, 버그픽스 5~9번 추가)

---

## 2026-04-08

### 작업 요약 (세션 8)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Claude Code 최근정보 메뉴 + AdminNews 페이지 추가 | 완료 |
| feat | /ultraplan 스킬 신규 생성 (멀티 에이전트 심층 계획 수립) | 완료 |
| feat | 프로젝트 비전 페이지 추가 — 시네마틱 디자인, 상단 메뉴 연동 | 완료 |
| docs | 프로젝트 비전 문서 작성 (docs/vision.md + CLAUDE.md 방침) | 완료 |

### 세부 내용 (세션 8)

- **최근정보 시스템**: AdminNews 페이지 + ClaudeNews DB 모델 + /api/news API
  - 5개 초기 뉴스 시드 (Ultra Plan, Pixel Streaming 2, Opus 4.6, NVIDIA Toolkit, MCP)
  - 아코디언 UI + 카테고리 배지 (컬러 코딩) + ReactMarkdown 렌더링
  - 사이드바 Claude Code 하위 "최근정보" 메뉴 추가
- **/ultraplan 스킬**: 4-Phase 프로세스 (Explore → Plan → Review → Execute)
  - 3개 모드 (Simple/Standard/Deep), 병렬 Explore 에이전트 최대 3개
  - 리스크 평가 (P0-P3), 롤백 계획, 검증 체크리스트
  - skills.json에 등록
- **비전 페이지** (`/vision`): 시네마틱 몰입형 디자인
  - 100vh 히어로 + Canvas 별빛 파티클 애니메이션 + 그라디언트 시머 타이틀
  - 4대 축 (포토리얼 가상공간, AI 1인기업, Pixel Streaming, 디지털 경제)
  - TwinverseDesk 3D perspective 목업 쇼케이스
  - Phase 1~6 타임라인 로드맵 (2026→2034)
  - 기술 스택 섹션 + CTA
  - IntersectionObserver 기반 스크롤 reveal 애니메이션
  - TopBar에 "비전" 메뉴 추가
- **비전 문서**: docs/vision.md (5대 원칙, 아키텍처, 로드맵, AI 행동지침)
  - CLAUDE.md에 비전 방침 섹션 추가 (모든 AI 세션 자동 적용)
  - dev-plan.md에 마일스톤 4~6 + 비전/울트라플랜/최근정보 기능 추가

### 작업 요약 (세션 9)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | /ultraplan Deep Mode — Twinverse Platform 전체 청사진 수립 | 완료 |

### 세부 내용 (세션 9)

- **Ultra Plan Deep Mode** 실행 — 3개 병렬 Explore 에이전트 + Plan 에이전트
  - 에이전트 1: 영향 범위 분석 (백엔드 6모델, 9라우터, 프론트엔드 30페이지 전수 스캔)
  - 에이전트 2: 아키텍처 분석 (데이터 흐름, 인증, DB, 배포 구조 심층 분석)
  - 에이전트 3: 리스크 & 의존성 분석 (보안, GPU, 디스크, 확장성 리스크 매트릭스)
- 16개 Step, 40+ 파일, 6개월 로드맵으로 구성된 청사진 완성
  - **Phase 1 마무리** (1-2주): 보안 강화, Alembic, 의존성 고정, 디스크 정리, 성능 최적화
  - **Phase 2 Pixel Streaming** (5-6주): 로컬 테스트 → Linux 패키징 → Docker GPU → WebRTC → 인증
  - **Phase 3 AI 에이전트** (5-6주): AI 게이트웨이 → 에이전트 프레임워크 → 채팅 UI → UE5 통신
  - **인프라 DevOps** (지속): CI/CD, 모니터링, DB 백업, GPU 스케일링
- P0 리스크 3건 식별: 디스크 86%, JWT 하드코딩, DB 마이그레이션 부재

---

## 2026-04-07

### 작업 요약 (세션 6)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Orbitron 서버 사양 문서 + 관리자 메뉴 추가 | 완료 |
| feat | TwinverseDesk UE5 C++ 프로젝트 초기화 (별도 리포) | 완료 |
| infra | Orbitron 서버 nvidia-container-toolkit 설치 (Docker GPU) | 완료 |
| infra | TwinverseDesk Dedicated Server 빌드 타겟 + Pixel Streaming 패키징 설정 | 완료 |
| infra | SSH 키 인증 등록 (Windows PC → Orbitron 서버) | 완료 |
| docs | /start, /end 스킬 업데이트 (Orbitron 서버 상태 확인/동기화) | 완료 |

### 세부 내용 (세션 6)

- TwinverseDesk UE5 5.7.4 C++ Third Person 프로젝트 생성 (`C:\WORK\TwinverseDesk`)
  - GitHub 리포 생성: ChoonwooLim/TwinverseDesk (Private, Git LFS 744파일 141MB)
  - `.gitignore` UE5 전용, `.gitattributes` LFS (uasset, umap, 텍스처, 오디오, 3D모델 등)
  - Pixel Streaming + Pixel Streaming 2 + PixelStreamingPlayer 플러그인 활성화
  - Dedicated Server 빌드 타겟 (`TwinverseDeskServer.Target.cs`) 추가
  - 패키징 설정 (Shipping, 맵/디렉토리 쿡, Pixel Streaming 기본 설정)
- Orbitron 서버 GPU 환경 확인 및 설정:
  - GTX 1080 x 2장 (각 8GB VRAM), NVIDIA Driver 580.126.09, CUDA 13.0
  - nvidia-container-toolkit v1.19.0 설치 → Docker 컨테이너에서 GPU 접근 가능
  - Docker GPU Runtime 등록 및 검증 완료
- `docs/orbitron-server.md` 신규 생성 (하드웨어/소프트웨어/GPU/컨테이너/Pixel Streaming 준비 상태)
- 백엔드 `_seed_docs()`에 orbitron-server 키 추가 → DB 자동 동기화
- 프론트엔드 사이드바에 "Orbitron 서버" 서브메뉴 추가
- SSH 키 인증 등록 (비밀번호 없이 Orbitron 접속 가능)
- /start 스킬: 세션 시작 시 SSH로 서버 상태(GPU/컨테이너/디스크) 자동 확인
- /end 스킬: 세션 종료 시 서버 상태 변경 감지 → 문서 자동 업데이트

---

## 2026-04-09

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Claw Code 분석 페이지 (01_instructkr 프로젝트 정밀 분석 보고서) | 완료 |
| feat | Claude Code 공식 레포 분석 페이지 (02_anthropics 프로젝트 정밀 분석 보고서) | 완료 |
| feat | 프론트엔드 npm run dev 시 백엔드 자동 실행 (concurrently) | 완료 |

### 세부 내용

- **Claw Code 분석 페이지** (`/admin/claw-code`):
  - D:\00_AI_ALL\01_instructkr 프로젝트 완전 분석 (Rust 재구현 Claude Code CLI)
  - 10개 섹션: 개요, 아키텍처 흐름, 10개 크레이트 상세, 9개 기능 카테고리, 기술 스택(12 라이브러리 + 7 프로토콜), Python 참조 구현, 빌드 커맨드, 패리티 상태, 프로젝트 철학, CI/CD
  - AdminClawCode.jsx + AdminClawCode.module.css (Dark Glass Neon 테마)
  - 사이드바 Claude Code > "Claw Code 분석" 서브메뉴 추가

- **Claude Code 공식 레포 분석 페이지** (`/admin/claude-code-repo`):
  - D:\00_AI_ALL\02_anthropics 프로젝트 완전 분석 (Anthropic 공식 Claude Code CLI)
  - 10개 섹션: 개요(설치 방법 4종), 아키텍처 흐름, 디렉토리 구조, 12개 공식 플러그인 상세, 14개 에이전트 테이블, 6종 훅 시스템(hookify 규칙 예시), 13개 슬래시 커맨드, 기술 스택, 4종 보안 기능, 11개 GitHub Actions
  - AdminClaudeCodeRepo.jsx + AdminClaudeCodeRepo.module.css (Dark Glass Neon 테마)
  - 사이드바 Claude Code > "공식 레포 분석" 서브메뉴 추가

- **백엔드 자동 실행**:
  - concurrently 패키지 설치 (devDependencies)
  - `npm run dev` → 백엔드(uvicorn) + 프론트엔드(vite) 동시 실행
  - `npm run dev:front` / `npm run dev:back` 개별 실행 스크립트 추가

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Phase 1 보안 강화 + Alembic + TVDeskRun PS2 스트리밍 연동 | 완료 |
| feat | PS2 Spawner — 유저별 독립 UE5 인스턴스 자동 생성/관리 | 완료 |
| feat | PS2 GPU 서버 외부 접근 — Cloudflare Tunnel + 독립 Spawner API | 완료 |
| feat | PS2 서버 자동 시작 (Wilbur + Spawner 자동 실행) | 완료 |
| feat | PS2 패키지 빌드 자동 감지 (packaged exe 우선, 에디터 fallback) | 완료 |
| feat | Pixel Streaming 2 DeskLaunch UI 컴포넌트 | 완료 |
| feat | PS2 외부 접근 — Cloudflare Tunnel + GPU 서버 통합 | 완료 |
| feat | 멀티 레벨 선택 UI + 백엔드 맵 파라미터 지원 | 완료 |
| feat | 어드민 Unreal Engine 문서 섹션 (5개 기술 문서 + 사이드바 메뉴) | 완료 |
| fix | TVDeskRun 원래 2D 가상오피스 페이지 복원 | 완료 |
| fix | subprocess.CREATE_NEW_PROCESS_GROUP Windows 전용 분기 | 완료 |
| fix | 프론트엔드 .env.production PS2 API URL 빌드 반영 | 완료 |
| fix | PS2 API URL 프로덕션 fallback 하드코딩 | 완료 |
| style | TopBar 메뉴명 'TwinverseDesk 실행하기' → 'TwinverseDesk 실행' | 완료 |

### 세부 내용 (세션 2)

- **PS2 Spawner 시스템 전체 구현**:
  - `backend/services/ps2_service.py` — UE5 인스턴스 생성/관리 핵심 서비스 (spawn, heartbeat, terminate, 좀비 정리)
  - `backend/routers/ps2_spawner.py` — 6개 사용자 API + 4개 관리자 API 엔드포인트
  - `backend/models/ps2_session.py` — PS2Session DB 모델 (session_id, pid, map_path, heartbeat 등)
  - 유저별 독립 UE5 인스턴스: 최대 3개 동시, 90초 heartbeat 타임아웃, psutil 기반 좀비 정리

- **UE5 맵 전환 (GameInstance 방식)**:
  - `TwinverseDeskGameInstance.cpp` — `-MapOverride=` CLI 인자 읽어서 `OpenLevel()` 호출
  - UE5 패키지 빌드에서 positional arg, ExecCmds, GameMode BeginPlay 모두 실패 → GameInstance::OnStart()가 유일한 해법
  - spawn 시 맵이 다르면 기존 세션 종료 후 새 세션 생성 (idempotent + map comparison)

- **DeskLaunch 멀티 레벨 UI**:
  - LEVELS 배열 (Modern Office, New York City) + 썸네일 카드 선택 UI
  - spawn 요청 시 선택된 맵 전송: `ps2api.post("/api/ps2/spawn", { map: selectedLevel.map })`

- **Cloudflare Tunnel**: ps2-api.twinverse.org → localhost:8000, ps2.twinverse.org → localhost:8080

- **어드민 UE 문서 5개**: Pixel Streaming 2, PS2 Spawner API, GPU 호스팅, EOS Framework, UE5 프로젝트 설정
  - `backend/main.py` _seed_docs()에 등록, 사이드바 "Unreal Engine" 드롭다운 메뉴 추가

---

### 작업 요약 (세션 3 — Ultra Plan: DeskRPG 2D→3D 재구현)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Phase 1: UE5 Office 기반 구조 — GameMode, Character, Controller, Furniture, Minimap | 완료 |
| feat | Phase 2: 멀티플레이어 + MetaHuman — GameState, PlayerState, AnimInstance, AvatarTypes, DedicatedServer | 완료 |
| feat | Phase 3: AI NPC 시스템 — NPC, Conversation(LLM), NPCManager, TaskBoard, MeetingRoom | 완료 |
| feat | Phase 4: 프론트엔드 연동 — DeskLaunch Office 모드, ChatWidget, MapEditor, HUD, NPC API | 완료 |
| feat | PS2 Dedicated Server 모델 + 서비스 (멀티플레이어 아키텍처) | 완료 |
| feat | NPC Chat API (/api/npc/chat — Anthropic/OpenAI LLM) | 완료 |

### 세부 내용 (세션 3)

- **Ultra Plan Deep Mode 실행**: DeskRPG 2D 가상 오피스를 UE5 3D 메타버스 오피스로 100% 재구현
  - 4 Phase, 22 Step, 17개 C++ 클래스 (34파일) + 3개 백엔드 파일 + 2개 프론트엔드 수정

- **Phase 1 — UE5 기반 구조** (Office/ 서브폴더, 기존 코드 무수정):
  - `Build.cs` +6 모듈 (NavigationSystem, NetCore, HTTP, Json, JsonUtilities, Niagara)
  - `TwinverseDeskGameMode` AGameModeBase→AGameMode (ServerTravel, PostLogin/Logout)
  - `OfficeCharacter` 리플리케이션, FAvatarAppearance, 클릭이동+WASD, 300 UU/s
  - `OfficePlayerController` Enhanced Input, 마우스커서, 줌(400~1500)
  - `OfficeGameMode` Office 전용 (Desk 스폰, HUD/GameState/PlayerState 연결)
  - `OfficeFurniture` 8종 가구 타입, 오버랩 상호작용
  - `OfficeMinimap` SceneCapture2D 직교 투영 10FPS

- **Phase 2 — 멀티플레이어 + MetaHuman**:
  - `OfficeGameState` 채팅 히스토리 + Multicast RPC (Socket.IO 대체)
  - `OfficePlayerState` 아바타/상태/데스크 리플리케이션
  - `OfficeAvatarTypes` MetaHuman 커스터마이징 (LPC 7그룹→MetaHuman 매핑)
  - `OfficeAnimInstance` Speed/Direction/ActionState 동기화
  - `PS2DedicatedServer` 모델 + `ps2_dedicated_service.py` (포트 자동 할당, 자동 종료)
  - PS2 Spawner API 4개 Office 엔드포인트 추가

- **Phase 3 — AI NPC 시스템**:
  - `OfficeNPC` 6 행동 상태, NavMesh 이동, 3초 재탐색, 홈 복귀
  - `OfficeNPCConversation` HTTP Async → /api/npc/chat → LLM (2초 쿨다운)
  - `OfficeNPCManager` 고용/해고, 데스크 할당, 5종 프리셋 페르소나
  - `OfficeTaskBoard` 5단계 상태, 60초 자동스캔, 5분 stall 감지
  - `OfficeMeetingRoom` 3모드(auto/manual/directed), 투표, 회의록 내보내기
  - `backend/routers/npc.py` NPC Chat API (Anthropic Claude / OpenAI 지원)

- **Phase 4 — 프론트엔드 연동**:
  - `ps2api.js` officeApi.join/status 추가
  - `DeskLaunch.jsx` Office 멀티플레이어 레벨 + Multiplayer 뱃지 + 진행률 업데이트
  - `OfficeChatWidget` UMG 채팅 (4채널, NPC 1:1, 500자 제한)
  - `OfficeMapEditor` 런타임 가구 배치 (그리드 스냅 50UU, 회전, Server RPC)
  - `OfficeHUD` 7개 위젯 통합 관리

---

### 작업 요약 (세션 4 — UE5 플러그인 + 이주 문제 해결 + 컴파일 에러 수정)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | TwinverseDesk.uproject에 ChaosVehiclesPlugin 활성화 | 완료 |
| fix | TwinverseDesk.uproject에 PCG 플러그인 5종 활성화 | 완료 |
| fix | ABP_Dashboard 이주 후 Cast/VehicleMovementComponent 에러 해결 가이드 | 완료 |
| fix | OfficeCharacter.cpp C4458 — 로컬 변수 Mesh가 ACharacter::Mesh 숨김 | 완료 |
| fix | OfficeNPC.cpp C4458 — 동일 Mesh 이름 충돌 | 완료 |

### 세부 내용 (세션 4)

- **PCG_Study_Modern 레벨 이주 문제 진단**:
  - 소스(A01_UE5_contents) vs 대상(TwinverseDesk) 프로젝트 구조 비교
  - 원인: ChaosVehiclesPlugin 미활성화 + 에셋 폴더 누락 (Vehicles/ 1,154파일, Car_Dealership/ 334파일)
  - TwinverseDesk.uproject에 ChaosVehiclesPlugin, PCG 관련 플러그인 5종 추가

- **ABP_Dashboard 블루프린트 에러 해결**:
  - Parent Class를 AnimInstance → VehicleAnimationInstance로 변경
  - Bad cast node 삭제 → 새 Cast To BP_Farton 노드 생성
  - As BP Farton에서 Vehicle Movement Component, Fuel, Get Forward Speed 노드 재생성/연결

- **UE5 패키징 C++ 컴파일 에러 수정**:
  - OfficeCharacter.cpp:133, OfficeNPC.cpp:217 — `USkeletalMeshComponent* Mesh` → `CharMesh`로 변수명 변경
  - `ACharacter::Mesh` 멤버와 이름 충돌 해결 (error C4458)

---

## 2026-04-10

### 작업 요약 (세션 1 — 배포 안정성)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | Dockerfile SECRET_KEY/DATABASE_URL 기본값 + HEALTHCHECK 추가 | 완료 |
| fix | lifespan 시작 작업 try-catch — 개별 실패 시에도 서버 기동 (크래시 루프 방지) | 완료 |
| fix | database.py pool_pre_ping=True — DB 연결 끊김 자동 복구 | 완료 |

### 작업 요약 (세션 2 — Office 맵 빌드 사양서)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | Office/ C++ 17 클래스 정밀 분석 → 맵 요구사항 추출 | 완료 |
| docs | docs/office-map-spec.md 신규 작성 — UE5 OfficeMain 13단계 빌드 가이드 | 완료 |

### 세부 내용 (세션 2)

- **C++ 코드 분석**: OfficeGameMode, OfficeCharacter, OfficeFurniture, OfficeMeetingRoom, OfficeNPCManager, OfficeMapEditor, OfficeTaskBoard 등 핵심 클래스 정독
- **핵심 발견**:
  - `DefaultEngine.ini:15`에 `ServerDefaultMap=/Game/Maps/Office/OfficeMain.OfficeMain` 이미 등록됨 → 맵을 정확히 이 경로에 만들면 DS 자동 로드
  - `OfficeGameMode::ChoosePlayerStart_Implementation`이 PlayerStartTag = "Desk" 액터만 round-robin 사용
  - `GlobalDefaultGameMode`가 아직 GM_SuperheroFlight → 전역 변경 금지, World Settings로만 override
  - Content/Office/, Content/Maps/Office/ 둘 다 미생성 (깨끗한 출발선)
- **사양서 13단계**: 디렉토리 → BP wrapper 12개 (BP_OfficeGameMode, BP_OfficeCharacter, BP_OfficeNPC, BP_Desk/Chair/Whiteboard/MeetingTable/Bookshelf/Plant/Monitor, BP_OfficeMeetingRoom) → World Settings → Geometry → PlayerStart 20개 (Desk 태그) → 데스크/의자/모니터 → MeetingRoom ×2 (Auto/Manual) → TaskBoard/장식 → NPC Home Points ×10 → 라이팅(Rect Light + 네온 톤) → NavMesh(Dynamic) → Pixel Streaming(Forward Shading) → PIE 검증
- **검증 체크리스트 9개 항목** + **후속 작업 6개** (MetaHuman, DS 패키징, BehaviorTree, TaskBoard UMG, MapEditor UI, 에셋 폴리싱) 명시

### 작업 요약 (세션 3 — DeskLaunch "플랫폼 연결오류" 긴급 수정)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | GPU PC 백엔드가 .env 한글 주석 → cp949 UnicodeDecodeError로 기동 실패 진단 | 완료 |
| fix | backend/.env 한글 주석 2줄 제거 (.env 규칙 위반이기도 함) | 완료 |
| fix | scripts/start_gpu_server.bat에 `set PYTHONUTF8=1` 추가 (영구 방어) | 완료 |

### 세부 내용 (세션 3)

- **증상**: `https://twinverseai.twinverse.org/twinversedesk/launch` 에서 "Start My Session" 클릭 시 CORS 에러 + ERR_FAILED로 "플랫폼 연결오류" 표시
- **진단 단계**:
  - 1차: `curl http://localhost:8000/health` → HTTP 000 (응답 없음)
  - 2차: `curl https://ps2-api.twinverse.org/health` → HTTP 502 (Cloudflare Tunnel은 살아있는데 upstream 죽음)
  - 3차: `netstat` 포트 8000 LISTENING 없음, `tasklist`에 python.exe 0개 (Wilbur/cloudflared만 생존)
  - 4차: `python -c "from main import app"` → `UnicodeDecodeError: 'cp949' codec can't decode byte 0xec in position 684` from starlette/config.py
- **근본 원인**: `backend/.env` line 24의 `# OpenClaw 서버` (UTF-8 한글) → slowapi Limiter 초기화 시 starlette Config가 .env를 읽는데 Windows 기본 cp949로 open → 즉시 크래시 → uvicorn 기동 실패
- **왜 CORS 에러로 보였나**: 서버가 응답 자체를 못 해서 preflight OPTIONS에 ACAO 헤더가 없음 → 브라우저가 "CORS policy에 의해 차단됨" 메시지 표시. 실제로는 CORS 코드(`main.py:461-466`)는 이미 올바르게 `twinverseai.twinverse.org` 포함 중이었음 (b8a8a24 커밋)
- **수정**:
  1. `backend/.env` — 한글 주석 `# https://hpanel.hostinger.com/ ---> VPS Hosting` + `# OpenClaw 서버` 제거 (.env는 local-only, gitignore됨)
  2. `scripts/start_gpu_server.bat:25` — `start "TwinverseAI Backend" /min cmd /c "set PYTHONUTF8=1&& cd /d ... && uvicorn ..."` — Python 전역 UTF-8 모드 강제
- **검증**: `start_gpu_server.bat` 재실행 후
  - `http://localhost:8000/health` → HTTP 200 (python.exe PID 60820 신규 기동)

### 작업 요약 (세션 4 — DeskLaunch "Invalid token" 후속 조치)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | ps2api.js에 401 response interceptor 추가 — stale 토큰 자동 로그아웃 | 완료 |

### 세부 내용 (세션 4)

- **증상**: CORS 해결 직후 새 에러 — 401 Unauthorized "Invalid token" (GET/POST /api/ps2/*)
- **크로스 검증**:
  - Orbitron docker exec env → `SECRET_KEY=orbitron-twinverseai-secret-key-2026` (GPU PC .env와 동일)
  - Orbitron 로그인 API로 방금 발급받은 토큰을 GPU PC 로컬/터널 양쪽 엔드포인트에 전송 → HTTP 200 ✓
  - 즉 양쪽 서버 완벽 호환, 서버 측 문제 아님
- **근본 원인**: 사용자 브라우저 localStorage의 토큰이 stale
  - ef6784c(2026-04-10 오전 SECRET_KEY 기본값 추가) 이전에 발급된 토큰이거나
  - 8시간 만료(ACCESS_TOKEN_EXPIRE_MINUTES = 60*8)
- **재발 방지**: [frontend/src/services/ps2api.js](frontend/src/services/ps2api.js)에 401 response interceptor 추가
  - api.js와 동일한 패턴: 401 → localStorage clear → /login 리다이렉트
  - 기존에 ps2api는 request interceptor만 있고 response interceptor가 없어서 stale 토큰으로 영원히 막혀 있었음
- **사용자 즉시 해결법**: 로그아웃 → 재로그인 (또는 Orbitron 재배포 후 자동 리다이렉트)

---

## 2026-04-12

### 작업 요약 (2026-04-10 인시던트 재발 방지 하드닝 + UI 상태 반영)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | backend load_dotenv 4곳에 `encoding="utf-8"` 명시 (defense-in-depth) | 완료 |
| fix | scripts/check_backend_ready.py 신규 — .env UTF-8+ASCII 검증 + backend import 테스트 + /health 폴링 | 완료 |
| fix | start_gpu_server.bat: pre-flight + post-launch health poll 연동, 실패 시 fail-loud | 완료 |
| style | DeskLaunch: 3D Virtual Office 카드 disabled + "개발중 / 실행 불가" 오버레이 | 완료 |
| fix | DeskLaunch: 헬스체크 실패를 silent catch에서 visible 오프라인 배너로 전환 | 완료 |
| docs | CLAUDE.md: .env ASCII-only 강제 규칙 + GPU 서버 기동 규칙 섹션 신설 | 완료 |

### 세부 내용

- **배경**: 2026-04-10 인시던트(.env cp949 크래시 → 터널 502 → 브라우저 CORS 오류) 재발 방지. 당일 즉시 수정은 이미 완료됐지만 사용자 지시 "다시는 재발하지 않게 단단히 조치"에 따라 3중 방어 + 가시성 강화.
- **3중 방어**:
  1. **Python 수준**: `load_dotenv(encoding="utf-8")` — [backend/main.py:7](backend/main.py#L7), [backend/ps2_server.py:21](backend/ps2_server.py#L21), [backend/alembic/env.py:11](backend/alembic/env.py#L11), [backend/seed_admin.py:4](backend/seed_admin.py#L4). 이제 PYTHONUTF8 미설정 환경에서도 .env는 UTF-8로 읽힘.
  2. **프로세스 수준**: `start_gpu_server.bat`가 `set PYTHONUTF8=1` 먼저 설정 후 pre-flight 실행 (이전부터 있던 방어).
  3. **사전 검증**: [scripts/check_backend_ready.py](scripts/check_backend_ready.py) — .env 바이트를 직접 읽어 UTF-8 검증 + 비-ASCII 바이트 발견 시 줄번호와 함께 거부. 이어서 `backend.main` import까지 수행해 startup-time 크래시를 uvicorn 띄우기 전에 포착.
- **fail-loud 기동**: [scripts/start_gpu_server.bat](scripts/start_gpu_server.bat) 흐름 재설계 — `[0/3] pre-flight` → `[1/3] uvicorn` → `[1/3 verify] /health 30초 폴링`. 어느 단계든 실패하면 `pause + exit /b 1`로 즉시 중단하고 에러 메시지 표시. 이제 silent crash가 원천적으로 불가능.
- **Office 카드 비활성화**: 사용자 지적 — OfficeMain.umap + Dedicated Server 모두 미구축 상태인데 카드는 클릭 가능했음. [DeskLaunch.jsx:11-25](frontend/src/pages/twinversedesk/DeskLaunch.jsx#L11-L25)에 `disabled: true`, `statusLabel: "개발중"`, `statusNote: "OfficeMain 맵 + Dedicated Server 구축 중"` 추가. 그레이스케일 필터 + 반투명 오버레이 + 주황색 "개발중 / 실행 불가" 배지. `useState` 기본값을 `LEVELS.find(l => !l.disabled)`로 변경해 Modern Office (Solo)가 기본 선택. `handleSpawn` 진입부에서 disabled 레벨이면 즉시 error + 안내 메시지.
- **가시성 강화**: DeskLaunch가 `catch { /* spawner unavailable */ }`로 헬스체크 실패를 삼키던 것을 `healthError` state + `offlineBanner` 컴포넌트로 대체. HTTP 상태 코드가 있으면 "HTTP 502"를, 네트워크 오류면 "GPU 서버 연결 불가 — 서버가 꺼져 있거나 Cloudflare 터널이 끊어졌습니다"를 표시. 2026-04-10처럼 사용자가 "플랫폼 연결오류"라는 모호한 문구만 보고 고생할 일 없음.
- **문서화**: [CLAUDE.md](CLAUDE.md) `.env 규칙` 섹션에 ASCII-only 강제 + 2026-04-10 인시던트 요약 + 3중 방어 명시. 신규 `GPU 서버 기동 규칙` 섹션에 "start_gpu_server.bat 사용 필수 / pre-flight 우회 금지 / CORS 오류 → 먼저 curl /health" 가이드 추가.
- **검증**: `python scripts/check_backend_ready.py` → 3개 체크 OK. `npm run build` → 프론트 클린 빌드 (DeskLaunch 청크 18.37kB).
- **커밋**: `9404cb2 fix: GPU 서버 기동 하드닝 + 3D Virtual Office 개발중 표시` → origin/main 푸시 완료.

### 현재 상태 (다음 세션 참고)

- **Office 메타버스 (Milestone 6)**: 코드/사양서는 완성, 실제 자산은 아직 없음.
  - ✅ [docs/office-map-spec.md](docs/office-map-spec.md) — UE5 에디터에서 `/Game/Maps/Office/OfficeMain` 빌드하는 13단계 가이드
  - ✅ `DefaultEngine.ini:15`에 `ServerDefaultMap=/Game/Maps/Office/OfficeMain.OfficeMain` 설정됨
  - ✅ C++ 17 클래스 (OfficeGameMode/Character/NPC/Furniture/MeetingRoom/TaskBoard 등) 컴파일 준비 완료
  - ❌ OfficeMain.umap 자체가 미존재 → 사양서대로 에디터 작업 필요
  - ❌ Dedicated Server 빌드/배포 미완 → PS2 backend의 `officeApi.join`이 아직 실행 불가
  - ❌ GPU PC의 UE5 패키지 빌드(Office 포함)도 미갱신
- **프론트 UI**: DeskLaunch에서 "3D Virtual Office" 카드는 명시적 개발중 상태. 위 3개 블로커 해소 후 [DeskLaunch.jsx:20](frontend/src/pages/twinversedesk/DeskLaunch.jsx#L20)의 `disabled: true` 제거하면 재활성화.
- **배포/운영 안정성**: 2026-04-10 인시던트 3중 방어 완료. GPU PC 재부팅 시 `start_gpu_server.bat`가 전부 자동 검증.
- **Next session 우선순위 제안**:
  1. 사용자가 UE5 에디터에서 OfficeMain.umap 실제 제작 (사양서 13단계 따라가기)
  2. Dedicated Server 빌드 파이프라인 구축
  3. GPU PC PS2 패키지에 Office 맵 포함 → `officeApi.join` 동작 확인
  4. DeskLaunch 카드 재활성화 + 실제 멀티플레이어 테스트

---

## 2026-04-13 (추가 세션 — PS2 GPU 서버 이전 + 고급 영상 앱 사양)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | 고급 영상 애플리케이션 기술 사양서 추가 (`.claude/specs/2026-04-13-high-end-video-app-spec.md`) | 완료 |
| infra | **별도 리포지토리 `TwinversePS2-Deploy` 에서 UE5 GPU 서버 twinverse-ai 이전** | 진행중 |

### 세부 내용

- **고급 영상 앱 사양**: 별도 스펙 문서 97줄 추가. 향후 UE5 Pixel Streaming 기반 영상 편집/협업
  애플리케이션 설계 근거.
- **PS2-Deploy 세션 (주 작업, 별도 리포)**: 상세 내역은 `C:\WORK\TwinversePS2-Deploy\docs\work-log.md`
  참고. 요약 — 자동 로그아웃 루프 해결(JWT), 컨테이너 non-root 전환, UE5 패키지 레이아웃 보존,
  최종 블로커: Linux cook 에 `/Game/PCG` 누락으로 맵 로드 실패. Windows Editor 에서 재패키지 필요.

### 다음 세션 참고

- **크로스 프로젝트 의존성**: TwinversePS2-Deploy 의 UE5 빌드가 재패키지되면 GPU 서버가 완전 동작.
  DeskLaunch 페이지의 Solo / Office 카드 둘 다 영향받음.
- Office 메타버스(Milestone 6) 작업은 여전히 위 3개 블로커 유지.

---

## 2026-04-14

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | **UE5 Linux cook 근본 원인 규명** (`TwinverseDesk/Config/DefaultGame.ini`) | 진행중 |
| chore | 포트포워딩 가이드(`iiff.twinverse.org`) 논의 — 진행 보류 | 보류 |

### 세부 내용

- **Linux cook 미동작 근본 원인 2건 식별 (별도 리포 TwinverseDesk)**:
  1. `+DirectoriesToNeverCook=(Path="")` — **빈 문자열이 "모든 경로"로 해석**되어 /Game/ 전체가
     쿡에서 제외되던 버그. 빈 항목 제거로 해결.
  2. `ServerDefaultMap=/Game/Maps/Office/OfficeMain` 이 존재하지 않는 맵을 가리켜 실패.
     `PCG_Study_Modern` 으로 교정(이전 세션).
- **효과 검증**: Cook 결과 594 packages(전부 Engine) → **3816 packages(/Game/ 전부 포함)**.
  PCG_Study_Modern 본체와 의존 에셋 정상 쿡 확인.
- **남은 이슈**: PCG 제너레이터가 `RainforestPack/NeoDubai/Fab` 를 하드 레퍼런스함 → 해당 디렉토리
  NeverCook 지정 시 "Content is missing from cook" 에러. NeverCook 목록에서 제거 필요.
  또한 `Variant_*` UE5 템플릿이 누락된 `/Script/TP_ThirdPerson` C++ 모듈을 참조해 StateTree 컴파일
  실패. Variant_* 는 NeverCook 유지 대상.
- **네트워크 작업 보류**: LG U+ 공유기(192.168.219.1) 에 `iiff.twinverse.org → 192.168.219.101:443`
  포트포워딩 가이드 제시했으나 사용자 판단으로 중단.

### 다음 세션 참고

- **TwinverseDesk `DefaultGame.ini` 최종 정리 필요**: NeverCook 에서 RainforestPack/NeoDubai/Fab
  제거, Variant_* / Maps 만 유지. 재패키지 → Linux pak 에 .umap 실존 확인.
- **이후 TwinversePS2-Deploy 배포**: 새 pak 으로 `build/` 덮어쓰기 → commit → `twinverse-ai`
  에서 `docker compose` 재기동 → Pixel Streaming 엔드투엔드 검증 (PS2-Deploy Milestone 5→6).
- **iiff 도메인 노출 방식 결정 필요**: Cloudflare Tunnel(ps2 방식) vs 직접 포트포워딩 — 보안/DDNS
  관점에서 터널 권장.

---

## 2026-04-15

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | TwinverseFolder 공유 드라이브(Z:) 설정/복구 가이드 작성 | 완료 |
| docs | Orbitron Pixel Streaming 플랫폼 설계 스펙 작성 | 완료 |
| docs | Orbitron Pixel Streaming 구현 계획서 작성 (7 Phase, ~35 tasks) | 완료 |
| infra | Orbitron 대시보드 프로젝트 27 `twinverse-ps2` start_command 복구 | 완료 |
| docs | 개발 AI 핸드오프 패키지 `Z:\OrbitronHandoff\` 배포 (README + spec + plan) | 완료 |

### 세부 내용

- **공유 드라이브 가이드** (`docs/shared-drive-setup.md`, commit 3fcfa93): Orbitron Samba
  + Windows `cmdkey`/`net use` 영구 매핑 절차. 2026-04-15 자격증명 소실 재발 방지 목적.
- **Pixel Streaming 플랫폼 설계** (`docs/superpowers/specs/...-design.md`, commit b7af68c):
  TwinverseAI 프로젝트 내부에 멀티 슬롯(Phase B) + 향후 멀티테넌트(Phase C) 진화 경로를
  포함한 전체 설계. 스키마(`ps_slots`, `ps_versions`), tus 업로드, 원격 배포, Cloudflare DNS/
  tunnel ingress 자동화, on-demand 컨테이너 수명 제어, 3-version 롤백, 보안(path traversal/
  command injection 방어) 모두 명세.
- **구현 계획서** (`docs/superpowers/plans/...-platform.md`, commit f8a95b2): Phase 0 사전
  조사 → Phase 1 DB/CRUD → Phase 2 업로드·추출 → Phase 3 이미지 빌드·전송 → Phase 4 활성화·
  롤백·DNS → Phase 5 런타임 제어·idle sweeper → Phase 6 UI → Phase 7 기존 `/opt/twinverse-ps2/`
  마이그레이션. TDD bite-sized task, 정확한 파일 경로/코드/커밋 메시지 포함.
- **Orbitron 대시보드**: project id 27 `twinverse-ps2` 가 이미 등록되어 있었으나 `start_command`
  가 `npm startdocker compose up -d` 로 파손되어 있어 SSH→psql 로 직접 UPDATE. build_command 도
  `docker build -t twinverse/ps2:latest .` 로 정정. 실제 배포는 repo orbitron.yaml 이 override.
- **핸드오프 패키지**: 외부 Orbitron 개발 AI 전달용으로 Z:\OrbitronHandoff\ 에 spec + plan +
  `README-handoff.md` 배치. README는 읽는 순서, Phase 0 게이트, 환경 정보(Orbitron/GPU 서버/
  Cloudflare), 기존 임시 구축본 정리 대상, 범위 경계(Phase B vs C) 명시.

### 다음 세션 참고

- **Phase 0 착수 대기**: Orbitron 개발 AI가 핸드오프 패키지 수령 → Phase 0 사전 조사(Orbitron
  내부 배포 파이프라인·Wilbur admin API·Cloudflare 토큰 범위) 결과 보고 기다림. 승인 후 Phase 1.
- **Phase 7 정리 대상**: 새 시스템 안정화 후 기존 project id 27 `twinverse-ps2` 및 GPU 서버
  `/opt/twinverse-ps2/` 철거. 현재는 임시 운영.
- **스펙 열린 질문**: spec 섹션 11 에 미해결 질문 목록 있음 — Phase 0 조사와 함께 해소.

---

## 2026-04-15 (추가 세션 — Office NPC OpenClaw LAN 이관 + 어드민 UI)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | NPC Tier 2 OpenClaw 게이트웨이를 Hostinger(Codex)에서 LAN twinverse-ai(Ollama qwen2.5:7b)로 이관 | 완료 |
| feat | LAN OpenClaw 를 Cloudflare Tunnel 로 `wss://openclaw.twinverse.org` 공개, DeskRPG 연결 성공 | 완료 |
| feat | TwinverseAI 어드민에 OpenClaw 디바이스 페어링 승인 UI + API 프록시 추가 (superadmin/admin 전용) | 완료 |
| docs | 메모리 `reference_openclaw_instances.md` 에 `docker restart` 금지 + agents.create 재시작 이슈 기록 | 완료 |

### 세부 내용

- **Hostinger Codex OAuth 고장 우회**: `OAuth token refresh failed for openai-codex` 에러
  (refresh token reuse) 때문에 DeskRPG NPC 응답 불가. Hostinger 인스턴스는 그대로 두고
  LAN twinverse-ai(192.168.219.117)에 두 번째 OpenClaw 컨테이너를 독립 기동
  (`ghcr.io/hostinger/hvps-openclaw:latest`, host network, `/srv/openclaw/data` 볼륨).
- **Ollama provider + qwen2.5:7b**: `gemma3:12b` / `gemma4:*` 는 Ollama tools 미지원이라
  Agent 용도 불가. `ollama/qwen2.5:7b` 로 전환, `contextWindow: 32768`, thinkingDefault=off.
- **Cloudflare Tunnel**: twinverse-ai `/etc/cloudflared/config.yml` 에
  `openclaw.twinverse.org → http://localhost:18789` ingress rule 추가. `systemctl restart
  cloudflared` 로 반영 (SIGHUP 미지원).
- **페어링 디버깅 절차**: Origin not allowed → `gateway.controlUi.allowedOrigins` 에
  `tvdesk.twinverse.org` 추가 / token_mismatch → `gateway.remote.token = gateway.auth.token` /
  pairing auto-approve 실패 → `openclaw devices approve <requestId>` 수동 승인.
- **어드민 UI (커밋 087b8e1)**: `backend/routers/admin_openclaw.py` 신규 (paramiko SSH →
  `docker exec openclaw openclaw devices list/approve`), `frontend/src/pages/admin/
  AdminOpenClawDevices.jsx` 신규, 사이드바 "OpenClaw 디바이스" 메뉴 추가. 앞으로 SSH 없이
  웹에서 페어링 승인 가능.
- **DeskRPG NPC 생성 이슈**: `agents.create` RPC 가 per-agent 플러그인 slot(`plugins.entries.
  browser.config`, `ollama.config`, `memory-core`)을 추가해 SIGUSR1 전체 재시작을 유발 →
  DeskRPG 의 follow-up `agents.files.set` 이 끊어져 "네트워크 오류"로 보임. 완화책으로
  `browser.enabled=false`, `memory-core.enabled=false` 로 전환.
- **`docker restart openclaw` 금지 규칙 확립**: 컨테이너 entrypoint 의 "Fixing data
  permissions" 단계가 EACCES 경합으로 `openclaw.json` 을 재생성 → 토큰 로테이트. 앞으로는
  `openclaw config set ...` CLI 만 사용 (내부 SIGUSR1 으로 토큰 보존).

### 다음 세션 참고

- **NPC 생성 재테스트 대기**: 새 토큰 `c96fc3c6148057…` 반영 후 DeskRPG 에서 NPC 생성 재시도.
  rate-limit(5분 창) 해제 기다리고 저장 → 에이전트 생성 성공 여부 확인.
- **browser/memory-core 비활성화 검증**: 이 설정으로 agents.create 재시작이 실제로 발생하지
  않는지(또는 빈도 감소) 확인. 여전히 재시작한다면 DeskRPG 의 create-agent flow 자체를 재시도
  tolerant 하게 바꾸는 것도 검토.
- **토큰 로테이트 대응**: LAN OpenClaw 는 docker restart 가 토큰 로테이트를 유발하므로,
  admin UI 에 "현재 토큰 조회" / ".env 자동 갱신" 기능 추가 검토.
- **Orbitron 배포본 동기화**: 지금 변경은 GPU PC 로컬 backend/.env 기반. Orbitron 배포본
  재빌드 시 어드민 UI 와 paramiko 의존성이 포함되는지 확인(`requirements.txt` 에 paramiko
  3.5.0 추가 완료).

---
