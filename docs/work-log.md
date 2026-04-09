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
